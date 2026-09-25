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
};

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
  const meta: EmailDomainMeta = { sendingId: sending.id, managedSending: sending.managed, records: [] };
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
