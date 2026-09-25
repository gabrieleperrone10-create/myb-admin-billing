import "server-only";
import { Resend } from "resend";
import { Prisma } from "@prisma/client";
import { basePrisma } from "@/lib/db";

/**
 * Domini email per azienda, gestiti con l'API Resend dell'account della
 * piattaforma (una sola API key, un solo webhook per tutte le aziende).
 *
 * Per ogni azienda si creano DUE domini Resend:
 *  - invio: il dominio dell'azienda (es. axismundi.it) con sola capacita'
 *    "sending" + tracciamento aperture/click. I record (DKIM su
 *    resend._domainkey, SPF/MX di ritorno su send.) stanno su sottodomini
 *    dedicati: le caselle di posta dell'azienda non vengono toccate;
 *  - ricezione: reply.<dominio> con sola capacita' "receiving". Il record MX sta
 *    SOLO su quel sottodominio: attivare la ricezione sul dominio principale
 *    sostituirebbe la posta aziendale.
 *
 * Se il dominio esiste gia' nell'account Resend (es. verificato a mano in
 * passato) lo si ADOTTA invece di fallire, e non lo si cancella mai da Resend
 * alla rimozione (managed = false).
 *
 * Company non e' un modello tenant (e' il tenant): si scrive con basePrisma
 * filtrando per id, dopo che la server action ha verificato membership e
 * permessi.
 */

export type DomainRecord = {
  scope: "sending" | "receiving";
  record: string;
  type: string;
  /** Nome host completo da inserire nel DNS */
  host: string;
  value: string;
  priority?: number;
  ttl?: string;
  status: string;
};

export type EmailDomainMeta = {
  sendingId?: string;
  receivingId?: string;
  managedSending?: boolean;
  managedReceiving?: boolean;
  records?: DomainRecord[];
  lastCheckedAt?: string;
  lastError?: string | null;
  /** Controlli automatici dopo il collegamento (+5 min, +3 h, +24 h) */
  autoCheck?: {
    startedAt: string;
    /** Indice del prossimo controllo in AUTO_CHECK_OFFSETS */
    step: number;
    nextCheckAt: string | null;
    /** Email agli Owner inviata (una sola volta) */
    notifiedAt?: string;
    doneAt?: string;
  };
};

/** Ritardi dei controlli automatici rispetto al collegamento del dominio. */
export const AUTO_CHECK_OFFSETS_MS = [5 * 60_000, 3 * 3_600_000, 24 * 3_600_000] as const;

export function newAutoCheck(now = new Date()): NonNullable<EmailDomainMeta["autoCheck"]> {
  return { startedAt: now.toISOString(), step: 0, nextCheckAt: new Date(now.getTime() + AUTO_CHECK_OFFSETS_MS[0]).toISOString() };
}

type DomainStatusFields = { emailDomain: string | null; emailDomainStatus: string | null; inboundDomain: string | null; inboundDomainStatus: string | null };

/** Tutto verificato: dominio di invio e, se presente, sottodominio di ricezione. */
export function isFullyVerified(c: DomainStatusFields): boolean {
  return c.emailDomainStatus === "verified" && (!c.inboundDomain || c.inboundDomainStatus === "verified");
}

/** C'e' un controllo automatico scaduto da eseguire? (solo lettura dei campi gia' caricati) */
export function autoCheckDue(c: DomainStatusFields & { emailDomainMeta: unknown }, now = new Date()): boolean {
  if (!c.emailDomain || isFullyVerified(c)) return false;
  const next = ((c.emailDomainMeta ?? {}) as EmailDomainMeta).autoCheck?.nextCheckAt;
  return !!next && new Date(next).getTime() <= now.getTime();
}

const REGION = "eu-west-1" as const;

let client: Resend | null = null;
function resend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY non impostata");
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

/** Messaggio italiano leggibile per gli errori tipici dell'API domini. */
function explain(err: { message?: string; name?: string } | null | undefined): string {
  const m = `${err?.name ?? ""} ${err?.message ?? ""}`.toLowerCase();
  if (m.includes("restricted")) return "La API key di Resend può solo inviare: serve una chiave con accesso completo (Resend › API Keys).";
  if (m.includes("limit") || m.includes("plan") || m.includes("upgrade")) {
    return "Il piano Resend attuale non permette altri domini. Passa a un piano superiore su Resend, oppure continua con il mittente condiviso.";
  }
  return err?.message || "Errore Resend";
}

/**
 * Nome host completo di un record. Resend restituisce i nomi RELATIVI ALLA ZONA
 * DNS (il dominio principale), anche per i sottodomini: per reply.esempio.it il
 * record MX arriva come "reply", non come "@". Per questo la base e' sempre il
 * dominio principale dell'azienda (zone), non il sottodominio.
 */
function fqdn(name: string, domain: string): string {
  const n = name.trim().replace(/\.$/, "").toLowerCase();
  if (!n || n === "@") return domain;
  return n === domain || n.endsWith(`.${domain}`) ? n : `${n}.${domain}`;
}

async function findDomainByName(name: string): Promise<string | null> {
  let after: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await resend().domains.list(after ? { after, limit: 100 } : { limit: 100 });
    if (error) throw new Error(explain(error));
    const hit = data?.data.find(d => d.name.toLowerCase() === name);
    if (hit) return hit.id;
    if (!data?.has_more || !data.data.length) return null;
    after = data.data[data.data.length - 1].id;
  }
  return null;
}

async function createOrAdopt(
  name: string,
  capabilities: { sending: "enabled" | "disabled"; receiving: "enabled" | "disabled" },
): Promise<{ id: string; managed: boolean }> {
  const { data, error } = await resend().domains.create({
    name,
    region: REGION,
    capabilities,
    ...(capabilities.sending === "enabled" ? { openTracking: true, clickTracking: true } : {}),
  });
  if (data) return { id: data.id, managed: true };
  const existing = await findDomainByName(name).catch(() => null);
  if (existing) return { id: existing, managed: false };
  throw new Error(explain(error));
}

async function fetchRecords(id: string, zone: string, scope: DomainRecord["scope"]) {
  const { data, error } = await resend().domains.get(id);
  if (error || !data) throw new Error(explain(error));
  // Il dominio Resend puo' essere un sottodominio (reply.esempio.it): se un suo
  // record risultasse sul dominio principale, lo si riporta sul sottodominio.
  // Un MX di ricezione sul dominio principale sostituirebbe la posta aziendale.
  const own = data.name.toLowerCase();
  const hostFor = (name: string) => {
    const h = fqdn(name, zone);
    return own !== zone && h === zone ? own : h;
  };
  const records: DomainRecord[] = data.records.map(r => ({
    scope,
    record: r.record,
    type: r.type,
    host: hostFor(r.name),
    value: r.value,
    priority: "priority" in r ? r.priority : undefined,
    ttl: r.ttl,
    status: r.status,
  }));
  return { status: data.status as string, records };
}

async function save(companyId: string, data: Prisma.CompanyUpdateInput) {
  await basePrisma.company.update({ where: { id: companyId }, data });
}

/** Collega un dominio all'azienda (crea/adotta su Resend) e salva i record da configurare. */
export async function setupCompanyEmailDomain(companyId: string, domain: string, withReceiving: boolean) {
  const other = await basePrisma.company.findFirst({
    where: { id: { not: companyId }, OR: [{ emailDomain: domain }, { inboundDomain: `reply.${domain}` }] },
    select: { id: true },
  });
  if (other) throw new Error("Questo dominio è già collegato a un'altra azienda");

  const sending = await createOrAdopt(domain, { sending: "enabled", receiving: "disabled" });
  const meta: EmailDomainMeta = { sendingId: sending.id, managedSending: sending.managed, records: [], autoCheck: newAutoCheck() };
  let inbound: string | null = null;
  if (withReceiving) {
    inbound = `reply.${domain}`;
    const receiving = await createOrAdopt(inbound, { sending: "disabled", receiving: "enabled" });
    meta.receivingId = receiving.id;
    meta.managedReceiving = receiving.managed;
  }
  await save(companyId, {
    emailDomain: domain,
    emailDomainStatus: "not_started",
    inboundDomain: inbound,
    inboundDomainStatus: inbound ? "not_started" : null,
    emailDomainMeta: meta as Prisma.InputJsonValue,
  });
  return refreshCompanyEmailDomain(companyId, { triggerVerify: false });
}

/** Aggiorna stato e record da Resend; con triggerVerify chiede a Resend di ricontrollare il DNS. */
export async function refreshCompanyEmailDomain(companyId: string, opts: { triggerVerify?: boolean } = {}) {
  const company = await basePrisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const meta = (company.emailDomainMeta ?? {}) as EmailDomainMeta;
  if (!company.emailDomain || !meta.sendingId) return company;

  const data: Prisma.CompanyUpdateInput = {};
  const records: DomainRecord[] = [];
  let lastError: string | null = null;
  try {
    if (opts.triggerVerify) {
      await resend().domains.verify(meta.sendingId);
      if (meta.receivingId) await resend().domains.verify(meta.receivingId);
    }
    const s = await fetchRecords(meta.sendingId, company.emailDomain, "sending");
    data.emailDomainStatus = s.status;
    records.push(...s.records);
    if (meta.receivingId && company.inboundDomain) {
      const r = await fetchRecords(meta.receivingId, company.emailDomain, "receiving");
      data.inboundDomainStatus = r.status;
      records.push(...r.records);
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }
  data.emailDomainMeta = {
    ...meta,
    records: records.length ? records : meta.records ?? [],
    lastCheckedAt: new Date().toISOString(),
    lastError,
  } as Prisma.InputJsonValue;
  await save(companyId, data);
  return basePrisma.company.findUniqueOrThrow({ where: { id: companyId } });
}

/** Scollega il dominio. Su Resend si cancellano solo i domini creati da qui (non quelli adottati). */
export async function removeCompanyEmailDomain(companyId: string) {
  const company = await basePrisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const meta = (company.emailDomainMeta ?? {}) as EmailDomainMeta;
  const errors: string[] = [];
  if (meta.sendingId && meta.managedSending) {
    const { error } = await resend().domains.remove(meta.sendingId);
    if (error) errors.push(explain(error));
  }
  if (meta.receivingId && meta.managedReceiving) {
    const { error } = await resend().domains.remove(meta.receivingId);
    if (error) errors.push(explain(error));
  }
  await save(companyId, {
    emailDomain: null,
    emailDomainStatus: null,
    inboundDomain: null,
    inboundDomainStatus: null,
    emailDomainMeta: Prisma.JsonNull,
  });
  return errors;
}


/**
 * Esegue il controllo automatico di un'azienda se e' scaduto. Chiamata dal
 * layout (in background, con after()) mentre qualcuno usa il gestionale e dal
 * cron giornaliero per tutte le aziende. Idempotente: se il controllo non e'
 * scaduto non fa nulla.
 * Dopo l'ultimo controllo (+24 h) ancora non verificato: email agli Owner, una volta.
 */
export async function runDomainAutoCheck(companyId: string, now = new Date()): Promise<"skip" | "verified" | "pending" | "notified"> {
  const before = await basePrisma.company.findUnique({ where: { id: companyId } });
  if (!before || !autoCheckDue(before, now)) return "skip";

  const c = await refreshCompanyEmailDomain(companyId, { triggerVerify: true });
  const meta = (c.emailDomainMeta ?? {}) as EmailDomainMeta;
  const ac = meta.autoCheck ?? newAutoCheck(now);

  if (isFullyVerified(c)) {
    await save(companyId, { emailDomainMeta: { ...meta, autoCheck: { ...ac, nextCheckAt: null, doneAt: now.toISOString() } } as Prisma.InputJsonValue });
    return "verified";
  }

  const step = ac.step + 1;
  if (step < AUTO_CHECK_OFFSETS_MS.length) {
    const nextCheckAt = new Date(new Date(ac.startedAt).getTime() + AUTO_CHECK_OFFSETS_MS[step]);
    // Se il gestionale non e' stato usato per un po', il prossimo controllo
    // non deve cadere nel passato: almeno fra 5 minuti.
    const next = nextCheckAt.getTime() > now.getTime() ? nextCheckAt : new Date(now.getTime() + AUTO_CHECK_OFFSETS_MS[0]);
    await save(companyId, { emailDomainMeta: { ...meta, autoCheck: { ...ac, step, nextCheckAt: next.toISOString() } } as Prisma.InputJsonValue });
    return "pending";
  }

  // Ultimo controllo fallito: avviso agli Owner (una volta sola).
  if (!ac.notifiedAt) {
    await notifyOwnersDomainPending(c).catch(e => console.error("[email-domain] notifica owner:", e));
  }
  await save(companyId, {
    emailDomainMeta: { ...meta, autoCheck: { ...ac, step, nextCheckAt: null, notifiedAt: ac.notifiedAt ?? now.toISOString() } } as Prisma.InputJsonValue,
  });
  return "notified";
}

async function notifyOwnersDomainPending(company: Awaited<ReturnType<typeof basePrisma.company.findUniqueOrThrow>>) {
  const { listCompanyMembers } = await import("@/lib/crm/members");
  // Moduli leggeri: questa funzione gira anche dal cron e da after(), senza
  // caricare la parte di sessione (lib/company) che non serve.
  const { senderFor } = await import("@/lib/email/identity");

  const owners = await basePrisma.appUserRole.findMany({
    where: { companyId: company.id, role: { name: "Owner" } },
    select: { clerkUserId: true },
  });
  const members = await listCompanyMembers(company.id);
  const ownerIds = new Set(owners.map(o => o.clerkUserId));
  // Senza Owner assegnati si avvisano tutti i membri; in ultima istanza l'email aziendale.
  const recipients = [...new Set(
    (ownerIds.size ? members.filter(m => ownerIds.has(m.userId)) : members).map(m => m.email).filter((e): e is string => !!e),
  )];
  if (!recipients.length && company.email) recipients.push(company.email);
  if (!recipients.length) return;

  const meta = (company.emailDomainMeta ?? {}) as EmailDomainMeta;
  const pending = (meta.records ?? []).filter(r => r.status !== "verified");
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = pending.map(r =>
    `<tr><td style="padding:4px 8px;border:1px solid #e5e7eb">${esc(r.type)}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace">${esc(r.host)}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;font-family:monospace;word-break:break-all">${esc(r.value.length > 80 ? r.value.slice(0, 80) + "…" : r.value)}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${esc(r.status)}</td></tr>`,
  ).join("");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const link = `${appUrl}/${company.slug}/settings/email`;
  const brand = company.brandName || company.name;
  const { fromName, fromEmail } = senderFor(company, brand);
  const from = fromEmail || process.env.EMAIL_FROM;
  if (!from) return;

  await resend().emails.send({
    from: `${fromName} <${from}>`,
    to: recipients,
    subject: `Dominio email non ancora verificato — ${company.emailDomain}`,
    html: `<p>Ciao,</p>
<p>a 24 ore dal collegamento il dominio <strong>${esc(company.emailDomain ?? "")}</strong>${company.inboundDomain ? ` (risposte su <strong>${esc(company.inboundDomain)}</strong>)` : ""} di ${esc(brand)} non risulta ancora verificato.</p>
${rows ? `<p>Record ancora da verificare:</p><table style="border-collapse:collapse;font-size:13px">${rows}</table>` : ""}
<p>Controlla che i record siano inseriti nel pannello DNS esattamente come indicato (su Cloudflare con Proxy "DNS only"), poi premi <strong>Verifica</strong>:<br><a href="${link}">${esc(link)}</a></p>
<p>Finché il dominio non è verificato le email continuano a partire dal mittente attuale.</p>`,
  });
}

/** Avvia lo schedule dei controlli se manca (domini collegati prima di questa funzione). */
export async function ensureAutoCheck(companyId: string) {
  const c = await basePrisma.company.findUnique({ where: { id: companyId } });
  if (!c?.emailDomain || isFullyVerified(c)) return;
  const meta = (c.emailDomainMeta ?? {}) as EmailDomainMeta;
  if (meta.autoCheck?.nextCheckAt || meta.autoCheck?.notifiedAt) return;
  await save(companyId, { emailDomainMeta: { ...meta, autoCheck: newAutoCheck() } as Prisma.InputJsonValue });
}
