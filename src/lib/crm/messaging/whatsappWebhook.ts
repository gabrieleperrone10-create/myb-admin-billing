import "server-only";
import { Prisma, type MessageStatus } from "@prisma/client";
import { basePrisma, companyDb, type CompanyDb } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { logActivity } from "@/lib/crm/activity";
import { upsertContact } from "@/lib/crm/contacts";
import { normalizePhone } from "@/lib/crm/phone";
import { verifyMetaSignature } from "./signatures";
import type { WhatsAppSecrets } from "./whatsapp";

/**
 * Webhook WhatsApp Cloud API: instradamento per azienda, verifica firma,
 * messaggi in entrata e stati di consegna.
 */

type WaMessage = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string; mime_type?: string; id?: string };
  video?: { caption?: string; mime_type?: string; id?: string };
  document?: { caption?: string; filename?: string; mime_type?: string; id?: string };
  audio?: { mime_type?: string; id?: string };
  sticker?: { id?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: unknown[];
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { title?: string }; list_reply?: { title?: string } };
  reaction?: { emoji?: string; message_id?: string };
  context?: { id?: string };
};

type WaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

type WaValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
};

export type WaPayload = { object?: string; entry?: { id?: string; changes?: { field?: string; value?: WaValue }[] }[] };

/** Estrae i phone_number_id presenti nel payload (servono per trovare l'azienda PRIMA di fidarsi del contenuto). */
export function phoneNumberIdsOf(payload: WaPayload): string[] {
  const ids = new Set<string>();
  for (const e of payload.entry ?? []) {
    for (const c of e.changes ?? []) {
      const id = c.value?.metadata?.phone_number_id;
      if (id) ids.add(String(id));
    }
  }
  return [...ids];
}

/**
 * Trova l'azienda proprietaria di ogni phone_number_id e verifica la firma
 * con il suo App Secret.
 *
 * Lookup globale con basePrisma: il webhook non ha azienda, il phone_number_id
 * e' l'unico aggancio. Si cercano TUTTE le integrazioni attive con quel
 * publicKey e si tiene quella il cui App Secret verifica la firma: se
 * un'azienda inserisse per errore (o per dolo) il phone_number_id di un'altra,
 * non potrebbe comunque produrre firme valide per quel traffico, e non
 * blocca l'azienda legittima.
 *
 * Ritorna:
 *  - "invalid" se almeno un numero noto ha firma non valida per tutte le
 *    integrazioni candidate → 401, nessuna scrittura (tutto o niente);
 *  - la mappa phone_number_id → companyId per i numeri verificati (i numeri
 *    sconosciuti vengono ignorati).
 */
export async function authenticateWhatsAppPayload(
  rawBody: string,
  signatureHeader: string | null,
  payload: WaPayload,
): Promise<"invalid" | Map<string, string>> {
  const routes = new Map<string, string>();
  for (const phoneId of phoneNumberIdsOf(payload)) {
    const candidates = await basePrisma.companyIntegration.findMany({
      where: { provider: "WHATSAPP", publicKey: phoneId, active: true },
    });
    if (!candidates.length) continue; // numero non nostro: ignorato

    const verified: string[] = [];
    for (const row of candidates) {
      let appSecret: string | undefined;
      try {
        appSecret = decryptJson<WhatsAppSecrets>(row).appSecret;
      } catch {
        continue;
      }
      if (appSecret && verifyMetaSignature(rawBody, signatureHeader, appSecret)) verified.push(row.companyId);
    }
    if (verified.length === 0) return "invalid";
    if (verified.length > 1) {
      // Stesso numero E stesso App Secret in due aziende: impossibile capire
      // a chi appartiene. Non si consegna a nessuno.
      console.warn(`[webhook whatsapp] phone_number_id ${phoneId} ambiguo fra ${verified.length} aziende: ignorato`);
      continue;
    }
    routes.set(phoneId, verified[0]);
  }
  return routes;
}

export async function processWhatsAppPayload(payload: WaPayload, routes: Map<string, string>): Promise<void> {
  for (const e of payload.entry ?? []) {
    for (const change of e.changes ?? []) {
      if (change.field && change.field !== "messages") continue;
      const value = change.value;
      const phoneId = value?.metadata?.phone_number_id;
      const companyId = phoneId ? routes.get(String(phoneId)) : undefined;
      if (!value || !companyId) continue;
      const db = companyDb(companyId);

      for (const m of value.messages ?? []) {
        const profile = value.contacts?.find(c => c.wa_id === m.from)?.profile?.name;
        await handleInboundMessage(db, companyId, m, profile);
      }
      for (const s of value.statuses ?? []) {
        await handleStatus(db, s);
      }
    }
  }
}

function tsToDate(ts?: string): Date {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

const MEDIA_LABEL: Record<string, string> = {
  image: "[immagine]",
  video: "[video]",
  audio: "[audio]",
  voice: "[audio]",
  document: "[documento]",
  sticker: "[sticker]",
  location: "[posizione]",
  contacts: "[contatto]",
  reaction: "[reazione]",
  unsupported: "[messaggio non supportato]",
};

function describe(m: WaMessage): { text: string; attachments: Record<string, unknown> | null } {
  switch (m.type) {
    case "text":
      return { text: m.text?.body ?? "", attachments: null };
    case "button":
      return { text: m.button?.text ?? "[pulsante]", attachments: { type: "button", payload: m.button?.payload } };
    case "interactive":
      return {
        text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[risposta interattiva]",
        attachments: { type: "interactive" },
      };
    case "reaction":
      return { text: `${MEDIA_LABEL.reaction} ${m.reaction?.emoji ?? ""}`.trim(), attachments: { type: "reaction", messageId: m.reaction?.message_id } };
    case "location": {
      const l = m.location;
      const where = [l?.name, l?.address].filter(Boolean).join(", ");
      return { text: where ? `${MEDIA_LABEL.location} ${where}` : MEDIA_LABEL.location, attachments: { type: "location", ...l } };
    }
    case "image":
    case "video":
    case "document": {
      const media = m[m.type];
      const label = MEDIA_LABEL[m.type];
      const caption = media?.caption?.trim();
      return {
        text: caption ? `${label} ${caption}` : label,
        attachments: {
          type: m.type,
          mediaId: media?.id,
          mimeType: media?.mime_type,
          ...(m.type === "document" ? { filename: m.document?.filename } : {}),
        },
      };
    }
    case "audio":
    case "sticker":
      return { text: MEDIA_LABEL[m.type], attachments: { type: m.type, mediaId: m[m.type]?.id } };
    default:
      return { text: MEDIA_LABEL[m.type] ?? `[${m.type}]`, attachments: { type: m.type } };
  }
}

function splitName(full?: string): { firstName?: string; lastName?: string } {
  const t = full?.trim();
  if (!t) return {};
  const i = t.indexOf(" ");
  return i < 0 ? { firstName: t } : { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() || undefined };
}

async function handleInboundMessage(db: CompanyDb, companyId: string, m: WaMessage, profileName?: string) {
  if (!m.id || !m.from) return;
  // Idempotenza: Meta ritenta finche' non riceve 200.
  const dup = await db.message.findUnique({ where: { providerMessageId: m.id }, select: { id: true } });
  if (dup) return;

  const e164 = normalizePhone(`+${m.from}`);
  if (!e164) {
    console.warn("[webhook whatsapp] numero mittente non valido, messaggio ignorato");
    return;
  }
  const { contact } = await upsertContact(db, companyId, { whatsapp: e164, ...splitName(profileName), source: "whatsapp" });

  const { text, attachments } = describe(m);
  const at = tsToDate(m.timestamp);
  let messageId: string;
  try {
    const created = await db.message.create({
      data: {
        companyId,
        contactId: contact.id,
        channel: "WHATSAPP",
        direction: "INBOUND",
        status: "RECEIVED",
        bodyText: text,
        fromAddress: e164,
        providerMessageId: m.id,
        inReplyTo: m.context?.id ?? null,
        attachments: attachments ? (attachments as Prisma.InputJsonValue) : undefined,
        createdAt: at,
      },
    });
    messageId = created.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; // consegna concorrente
    throw e;
  }

  await db.contact.update({ where: { id: contact.id }, data: { unreadCount: { increment: 1 } } });
  await db.contact.updateMany({
    where: { id: contact.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: at } }] },
    data: { lastMessageAt: at },
  });
  await logActivity(db, companyId, {
    contactId: contact.id,
    type: "WHATSAPP_RECEIVED",
    data: { messageId, preview: text.slice(0, 140) },
    occurredAt: at,
  });
}

const RANK: Partial<Record<MessageStatus, number>> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };

async function handleStatus(db: CompanyDb, s: WaStatus) {
  if (!s.id) return;
  const msg = await db.message.findUnique({
    where: { providerMessageId: s.id },
    select: { id: true, status: true, deliveredAt: true, readAt: true },
  });
  if (!msg) return; // messaggio non inviato dal CRM (es. dall'app WhatsApp Business)
  const at = tsToDate(s.timestamp);

  if (s.status === "failed") {
    const err = s.errors?.[0];
    const reason = [err?.title ?? err?.message, err?.error_data?.details].filter(Boolean).join(" — ") || "Invio non riuscito";
    await db.message.updateMany({ where: { id: msg.id, status: { not: "FAILED" } }, data: { status: "FAILED", error: reason.slice(0, 500) } });
    return;
  }

  const next: MessageStatus | null =
    s.status === "read" ? "READ" : s.status === "delivered" ? "DELIVERED" : s.status === "sent" ? "SENT" : null;
  if (!next) return;

  const data: Prisma.MessageUpdateManyMutationInput = {};
  // Gli stati possono arrivare fuori ordine: non si torna mai indietro.
  if (msg.status !== "FAILED" && (RANK[next] ?? 0) > (RANK[msg.status] ?? 0)) data.status = next;
  if ((next === "DELIVERED" || next === "READ") && !msg.deliveredAt) data.deliveredAt = at;
  if (next === "READ" && !msg.readAt) data.readAt = at;
  if (Object.keys(data).length) await db.message.updateMany({ where: { id: msg.id }, data });
}
