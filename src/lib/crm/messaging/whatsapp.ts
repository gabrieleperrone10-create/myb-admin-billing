import "server-only";
import type { CompanyIntegration } from "@prisma/client";
import { companyDb, type CompanyDb } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { logActivity } from "@/lib/crm/activity";
import { toWhatsAppId } from "@/lib/crm/phone";

/**
 * WhatsApp Cloud API (Meta) — invio e configurazione per azienda.
 *
 * Perche' fetch diretto alla Graph API e non whatsapp-api-js: servono quattro
 * chiamate (invio testo, invio template, elenco template, lettura del numero)
 * con un token DIVERSO per ogni azienda, letto e decifrato a ogni richiesta.
 * La libreria e' pensata attorno a un'istanza con token fisso e a un proprio
 * gestore di webhook; con fetch il payload e' esattamente quello documentato da
 * Meta, gli errori Graph arrivano intatti e non c'e' stato condiviso fra
 * aziende da gestire.
 *
 * CompanyIntegration NON e' in TENANT_MODELS (chiave composta companyId +
 * provider): l'estensione di companyDb() la lascia passare senza filtro, quindi
 * ogni query qui filtra ESPLICITAMENTE per companyId.
 */

export const GRAPH_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type WhatsAppSecrets = { accessToken: string; appSecret: string };
export type WhatsAppMeta = { wabaId?: string; displayPhone?: string; verifiedName?: string; lastCheckAt?: string; lastCheckOk?: boolean };

export type WhatsAppConfig = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  accessToken: string;
  appSecret: string;
};

/** Stato per la UI: nessun segreto, solo l'indicazione che c'e'. */
export type WhatsAppStatus = {
  configured: boolean;
  active: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayPhone: string | null;
  tokenLast4: string | null;
  hasAppSecret: boolean;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
};

async function loadIntegration(companyId: string): Promise<CompanyIntegration | null> {
  // Filtro esplicito per companyId: vedi commento in testa.
  return companyDb(companyId).companyIntegration.findUnique({
    where: { companyId_provider: { companyId, provider: "WHATSAPP" } },
  });
}

export function integrationToConfig(row: CompanyIntegration): WhatsAppConfig | null {
  if (!row.publicKey || !row.secretCipher) return null;
  const meta = (row.meta ?? {}) as WhatsAppMeta;
  const secrets = decryptJson<WhatsAppSecrets>(row);
  if (!secrets.accessToken || !secrets.appSecret) return null;
  return {
    phoneNumberId: row.publicKey,
    wabaId: meta.wabaId ?? "",
    displayPhone: meta.displayPhone ?? "",
    accessToken: secrets.accessToken,
    appSecret: secrets.appSecret,
  };
}

/** Config completa (con segreti decifrati) SOLO se l'integrazione e' attiva. Mai verso il client. */
export async function getWhatsAppConfig(companyId: string): Promise<WhatsAppConfig | null> {
  const row = await loadIntegration(companyId);
  if (!row || !row.active) return null;
  try {
    return integrationToConfig(row);
  } catch {
    // chiave di cifratura cambiata o riga manomessa: come non configurato
    return null;
  }
}

export async function getWhatsAppStatus(companyId: string): Promise<WhatsAppStatus> {
  const row = await loadIntegration(companyId);
  const meta = (row?.meta ?? {}) as WhatsAppMeta;
  let tokenLast4: string | null = null;
  let hasAppSecret = false;
  if (row?.secretCipher) {
    try {
      const s = decryptJson<WhatsAppSecrets>(row);
      tokenLast4 = s.accessToken ? s.accessToken.slice(-4) : null;
      hasAppSecret = !!s.appSecret;
    } catch {
      /* segreto illeggibile: risulta non configurato */
    }
  }
  return {
    configured: !!(row?.publicKey && tokenLast4 && hasAppSecret),
    active: !!row?.active,
    phoneNumberId: row?.publicKey ?? null,
    wabaId: meta.wabaId ?? null,
    displayPhone: meta.displayPhone ?? null,
    tokenLast4,
    hasAppSecret,
    lastCheckAt: meta.lastCheckAt ?? null,
    lastCheckOk: meta.lastCheckOk ?? null,
  };
}

// ─── Graph API ─────────────────────────────────────────────────────────────

type GraphError = { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };

export class WhatsAppApiError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

/** Messaggio leggibile, senza mai includere il token. */
function describeGraphError(err: GraphError | undefined, status: number): WhatsAppApiError {
  const code = err?.code;
  const known: Record<number, string> = {
    190: "Access token non valido o scaduto",
    10: "Permessi insufficienti sul token (servono whatsapp_business_messaging e whatsapp_business_management)",
    100: "Parametro non valido",
    131047: "Sono passate piu' di 24 ore dall'ultimo messaggio del contatto: serve un template approvato",
    131026: "Il numero non e' raggiungibile su WhatsApp",
    131051: "Tipo di messaggio non supportato",
    132000: "Numero di parametri del template errato",
    132001: "Template inesistente o non approvato per questa lingua",
    470: "Fuori dalla finestra di 24 ore: serve un template approvato",
  };
  const base = (code && known[code]) || err?.message || `Errore WhatsApp (HTTP ${status})`;
  const details = err?.error_data?.details;
  return new WhatsAppApiError(details && details !== base ? `${base} — ${details}` : base, code);
}

async function graph<T>(path: string, accessToken: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GRAPH}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new WhatsAppApiError(`Graph API non raggiungibile: ${e instanceof Error ? e.message : String(e)}`);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: GraphError } & T;
  if (!res.ok || json.error) throw describeGraphError(json.error, res.status);
  return json;
}

/** Legge il numero dalla Graph API: usato da "Verifica connessione". */
export async function fetchPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
  return graph<{ id: string; display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
    `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
    accessToken,
  );
}

/**
 * Iscrive l'app al WABA (POST /{waba}/subscribed_apps): senza questo Meta non
 * invia i webhook dei messaggi di quel WABA. Idempotente.
 */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<boolean> {
  const res = await graph<{ success?: boolean }>(`/${encodeURIComponent(wabaId)}/subscribed_apps`, accessToken, { method: "POST" });
  return res.success === true;
}

export type WhatsAppTemplate = {
  name: string;
  language: string;
  category: string;
  /** Testo del componente BODY con i segnaposto {{1}}, {{2}}… */
  bodyText: string;
  /** Numero di parametri del BODY */
  paramCount: number;
};

/** Template APPROVATI del WABA dell'azienda. [] se WhatsApp non e' configurato. */
export async function listWhatsAppTemplates(companyId: string): Promise<WhatsAppTemplate[]> {
  const cfg = await getWhatsAppConfig(companyId);
  if (!cfg || !cfg.wabaId) return [];
  type Tpl = { name: string; language: string; status: string; category: string; components?: { type: string; text?: string }[] };
  const out: WhatsAppTemplate[] = [];
  let path: string | null =
    `/${encodeURIComponent(cfg.wabaId)}/message_templates?fields=name,language,status,category,components&status=APPROVED&limit=100`;
  // Paginazione Graph: al massimo 5 pagine (500 template) per non restare appesi.
  for (let page = 0; path && page < 5; page++) {
    const res: { data?: Tpl[]; paging?: { cursors?: { after?: string }; next?: string } } = await graph(path, cfg.accessToken);
    for (const t of res.data ?? []) {
      if (t.status !== "APPROVED") continue;
      const body = t.components?.find(c => c.type === "BODY")?.text ?? "";
      const params = new Set(Array.from(body.matchAll(/\{\{\s*(\d+)\s*\}\}/g), m => m[1]));
      out.push({ name: t.name, language: t.language, category: t.category, bodyText: body, paramCount: params.size });
    }
    const after = res.paging?.next ? res.paging.cursors?.after : undefined;
    path = after
      ? `/${encodeURIComponent(cfg.wabaId)}/message_templates?fields=name,language,status,category,components&status=APPROVED&limit=100&after=${encodeURIComponent(after)}`
      : null;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function renderTemplateBody(bodyText: string, params: string[]): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => params[Number(n) - 1] ?? m);
}

// ─── Finestra di servizio 24h ──────────────────────────────────────────────

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Meta permette messaggi liberi solo entro 24 ore dall'ultimo messaggio
 * RICEVUTO dal contatto; fuori finestra servono template approvati.
 */
export async function isInsideServiceWindow(db: CompanyDb, contactId: string): Promise<boolean> {
  const last = await lastInboundWhatsAppAt(db, contactId);
  return !!last && Date.now() - last.getTime() < SERVICE_WINDOW_MS;
}

export async function lastInboundWhatsAppAt(db: CompanyDb, contactId: string): Promise<Date | null> {
  const last = await db.message.findFirst({
    where: { contactId, channel: "WHATSAPP", direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}

// ─── Invio ─────────────────────────────────────────────────────────────────

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string; messageId?: string };

type Recipient = { contactId: string; to: string; toE164: string };

async function resolveRecipient(db: CompanyDb, contactId: string): Promise<Recipient | { error: string }> {
  const c = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, whatsapp: true, phone: true, whatsappOptOut: true },
  });
  if (!c) return { error: "Contatto non trovato" };
  if (c.whatsappOptOut) return { error: "Il contatto ha chiesto di non ricevere messaggi WhatsApp" };
  const e164 = c.whatsapp ?? c.phone;
  if (!e164) return { error: "Il contatto non ha un numero WhatsApp o di telefono" };
  return { contactId: c.id, toE164: e164, to: toWhatsAppId(e164) };
}

async function sendAndRecord(
  db: CompanyDb,
  companyId: string,
  cfg: WhatsAppConfig,
  r: Recipient,
  opts: { payload: Record<string, unknown>; bodyText: string; sentByUserId?: string | null; template?: string },
): Promise<SendResult> {
  const message = await db.message.create({
    data: {
      companyId,
      contactId: r.contactId,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      status: "QUEUED",
      bodyText: opts.bodyText,
      fromAddress: cfg.displayPhone || cfg.phoneNumberId,
      toAddress: r.toE164,
      sentByUserId: opts.sentByUserId ?? null,
      attachments: opts.template ? { template: opts.template } : undefined,
    },
  });

  let wamid: string | null = null;
  let error: string | null = null;
  try {
    const res = await graph<{ messages?: { id: string }[] }>(`/${encodeURIComponent(cfg.phoneNumberId)}/messages`, cfg.accessToken, {
      method: "POST",
      body: { messaging_product: "whatsapp", recipient_type: "individual", to: r.to, ...opts.payload },
    });
    wamid = res.messages?.[0]?.id ?? null;
    if (!wamid) error = "Risposta WhatsApp senza id messaggio";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const now = new Date();
  await db.message.update({
    where: { id: message.id },
    data: error ? { status: "FAILED", error } : { status: "SENT", providerMessageId: wamid },
  });
  if (error) return { ok: false, error, messageId: message.id };

  await db.contact.updateMany({
    where: { id: r.contactId, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: now } }] },
    data: { lastMessageAt: now },
  });
  await logActivity(db, companyId, {
    contactId: r.contactId,
    type: "WHATSAPP_SENT",
    data: { messageId: message.id, preview: opts.bodyText.slice(0, 140), template: opts.template },
    actorUserId: opts.sentByUserId ?? null,
    occurredAt: now,
  });
  return { ok: true, messageId: message.id };
}

/** Messaggio di testo libero. Solo dentro la finestra di 24h (altrimenti errore: usare un template). */
export async function sendWhatsAppText(
  db: CompanyDb,
  companyId: string,
  params: { contactId: string; text: string; sentByUserId?: string | null },
): Promise<SendResult> {
  const text = params.text.trim();
  if (!text) return { ok: false, error: "Messaggio vuoto" };
  if (text.length > 4096) return { ok: false, error: "Messaggio troppo lungo (max 4096 caratteri)" };
  const cfg = await getWhatsAppConfig(companyId);
  if (!cfg) return { ok: false, error: "WhatsApp non configurato per questa azienda" };
  const r = await resolveRecipient(db, params.contactId);
  if ("error" in r) return { ok: false, error: r.error };
  if (!(await isInsideServiceWindow(db, r.contactId))) {
    return { ok: false, error: "Fuori dalla finestra di 24 ore: usa un template approvato" };
  }
  return sendAndRecord(db, companyId, cfg, r, {
    payload: { type: "text", text: { preview_url: true, body: text } },
    bodyText: text,
    sentByUserId: params.sentByUserId,
  });
}

/**
 * Template approvato (utilizzabile anche fuori finestra: promemoria, primo
 * contatto). `bodyParams` riempie {{1}}, {{2}}… del BODY; `renderedText`, se
 * dato, e' il testo salvato nel thread (altrimenti "[Template nome] parametri").
 */
export async function sendWhatsAppTemplate(
  db: CompanyDb,
  companyId: string,
  params: {
    contactId: string;
    templateName: string;
    language: string;
    bodyParams?: string[];
    renderedText?: string;
    sentByUserId?: string | null;
  },
): Promise<SendResult> {
  const cfg = await getWhatsAppConfig(companyId);
  if (!cfg) return { ok: false, error: "WhatsApp non configurato per questa azienda" };
  const r = await resolveRecipient(db, params.contactId);
  if ("error" in r) return { ok: false, error: r.error };
  const bodyParams = params.bodyParams ?? [];
  const template: Record<string, unknown> = { name: params.templateName, language: { code: params.language } };
  if (bodyParams.length) {
    template.components = [{ type: "body", parameters: bodyParams.map(text => ({ type: "text", text })) }];
  }
  return sendAndRecord(db, companyId, cfg, r, {
    payload: { type: "template", template },
    bodyText: params.renderedText ?? `[Template ${params.templateName}]${bodyParams.length ? ` ${bodyParams.join(" · ")}` : ""}`,
    sentByUserId: params.sentByUserId,
    template: params.templateName,
  });
}
