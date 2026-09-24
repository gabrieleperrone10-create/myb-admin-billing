import "server-only";
import { Prisma, type Message } from "@prisma/client";
import { basePrisma, companyDb } from "@/lib/db";
import { logActivity } from "@/lib/crm/activity";
import { getResend } from "./email";
import { acceptedInboundDomains } from "@/lib/email/identity";
import { extractEmailAddress, htmlToText, parseReplyToken, stripQuotedReply } from "./signatures";

/**
 * Elaborazione degli eventi Resend GIA' verificati (firma Svix controllata in
 * api/webhooks/resend/route.ts prima di arrivare qui).
 *
 * Lookup globali con basePrisma: un webhook non ha sessione ne' azienda,
 * quindi il primo passo e' per forza una ricerca su tutte le aziende per una
 * chiave globalmente unica (Message.providerMessageId, Contact.replyToken).
 * Subito dopo si passa a companyDb(companyId) per tutte le scritture.
 *
 * Idempotenza: Svix ritenta gli eventi e puo' consegnarli due volte. Ogni
 * scrittura e' condizionata (updateMany con where sullo stato precedente,
 * unique su providerMessageId per gli inbound) e l'attivita' si registra solo
 * se la scrittura condizionata ha effettivamente cambiato una riga.
 */

type EmailEventData = {
  email_id: string;
  created_at?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message_id?: string;
  tags?: Record<string, string> | { name: string; value: string }[];
  bounce?: { message?: string; type?: string; subType?: string };
  click?: { link?: string };
  failed?: { reason?: string };
  suppressed?: { message?: string };
  attachments?: { id: string; filename: string | null; content_type: string }[];
};

export type ResendEvent = { type: string; created_at?: string; data: EmailEventData };

export async function handleResendEvent(evt: ResendEvent): Promise<string> {
  if (!evt?.type || !evt.data?.email_id) return "ignorato: payload senza email_id";
  switch (evt.type) {
    case "email.received":
      return handleInbound(evt.data);
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
    case "email.bounced":
    case "email.failed":
    case "email.suppressed":
    case "email.complained":
      return handleStatus(evt.type, evt.data, evt.created_at);
    default:
      return `ignorato: ${evt.type}`;
  }
}

function tagValue(tags: EmailEventData["tags"], name: string): string | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.find(t => t.name === name)?.value;
  return tags[name];
}

async function findOutbound(data: EmailEventData): Promise<Message | null> {
  // Lookup globale inevitabile (vedi commento in testa): providerMessageId e' unique.
  const byProvider = await basePrisma.message.findUnique({ where: { providerMessageId: data.email_id } });
  if (byProvider) return byProvider;
  // Fallback: evento arrivato prima che sendContactEmail salvasse l'id Resend.
  // I tag li abbiamo messi noi e il payload e' firmato; si richiede comunque
  // che id e azienda coincidano.
  const id = tagValue(data.tags, "crm_message");
  const companyId = tagValue(data.tags, "crm_company");
  if (!id || !companyId) return null;
  return basePrisma.message.findFirst({ where: { id, companyId, channel: "EMAIL", direction: "OUTBOUND" } });
}

async function handleStatus(type: string, data: EmailEventData, createdAt?: string): Promise<string> {
  const msg = await findOutbound(data);
  // Email non del CRM (fatture, automazioni: stesso account Resend) → nulla da fare.
  if (!msg) return "ignorato: messaggio non del CRM";

  const db = companyDb(msg.companyId);
  const at = createdAt ? new Date(createdAt) : new Date();
  const when = Number.isNaN(at.getTime()) ? new Date() : at;
  const subject = msg.subject ?? undefined;

  if (type === "email.delivered") {
    await db.message.updateMany({ where: { id: msg.id, deliveredAt: null }, data: { deliveredAt: when } });
    await db.message.updateMany({ where: { id: msg.id, status: { in: ["QUEUED", "SENT"] } }, data: { status: "DELIVERED" } });
    return "delivered";
  }

  if (type === "email.opened") {
    const { count } = await db.message.updateMany({ where: { id: msg.id, openedAt: null }, data: { openedAt: when } });
    if (count === 1) {
      await logActivity(db, msg.companyId, {
        contactId: msg.contactId,
        type: "EMAIL_OPENED",
        data: { messageId: msg.id, subject },
        occurredAt: when,
      });
    }
    return count === 1 ? "opened" : "opened: duplicato";
  }

  if (type === "email.clicked") {
    const url = data.click?.link;
    await db.message.updateMany({ where: { id: msg.id, clickedAt: null }, data: { clickedAt: when } });
    // un click implica un'apertura (i pixel sono spesso bloccati)
    await db.message.updateMany({ where: { id: msg.id, openedAt: null }, data: { openedAt: when } });
    // Una sola attivita' per (messaggio, url): i duplicati Svix e i click
    // ripetuti sullo stesso link non riempiono la cronologia.
    const already = await db.activity.findFirst({
      where: {
        contactId: msg.contactId,
        type: "EMAIL_CLICKED",
        AND: [
          { data: { path: ["messageId"], equals: msg.id } },
          ...(url ? [{ data: { path: ["url"], equals: url } }] : []),
        ],
      },
      select: { id: true },
    });
    if (!already) {
      await logActivity(db, msg.companyId, {
        contactId: msg.contactId,
        type: "EMAIL_CLICKED",
        data: { messageId: msg.id, subject, url },
        occurredAt: when,
      });
    }
    return already ? "clicked: duplicato" : "clicked";
  }

  if (type === "email.complained") {
    // Segnalazione come spam: si smette di scrivergli.
    await db.contact.updateMany({ where: { id: msg.contactId }, data: { emailOptOut: true } });
    return "complained: opt-out";
  }

  // bounced / failed / suppressed → non recapitata
  const reason =
    data.bounce?.message ?? data.failed?.reason ?? data.suppressed?.message ?? type.replace("email.", "");
  const { count } = await db.message.updateMany({
    where: { id: msg.id, status: { not: "FAILED" } },
    data: { status: "FAILED", error: reason.slice(0, 500) },
  });
  if (count === 1) {
    await logActivity(db, msg.companyId, {
      contactId: msg.contactId,
      type: "EMAIL_BOUNCED",
      data: { messageId: msg.id, reason: reason.slice(0, 300) },
      occurredAt: when,
    });
  }
  return count === 1 ? "failed" : "failed: duplicato";
}

async function resolveInboundContact(data: EmailEventData): Promise<{ id: string; companyId: string } | null> {
  const recipients = [...(data.to ?? []), ...(data.cc ?? []), ...(data.bcc ?? [])];
  for (const r of recipients) {
    const token = parseReplyToken(r);
    if (!token) continue;
    // Lookup globale inevitabile: replyToken e' unique su tutte le aziende ed
    // e' proprio cio' che identifica azienda + contatto.
    const c = await basePrisma.contact.findUnique({
      where: { replyToken: token },
      select: { id: true, companyId: true, company: { select: { inboundDomain: true, inboundDomainStatus: true } } },
    });
    if (!c) continue;
    // Il dominio di arrivo deve essere uno di quelli dell'azienda del contatto
    // (il suo sottodominio verificato o quello condiviso della piattaforma):
    // un token valido su un dominio di un'altra azienda non si accetta.
    const host = extractEmailAddress(r)?.split("@")[1] ?? "";
    if (!acceptedInboundDomains(c.company).includes(host)) continue;
    return { id: c.id, companyId: c.companyId };
  }

  // Nessun token: si scarta. Il "From" di un'email non e' autenticato (niente
  // controllo SPF/DKIM qui), quindi associare per mittente permetterebbe a
  // chiunque di inserire messaggi nel thread di un cliente vero scrivendo al
  // dominio inbound con un From falsificato. Le risposte legittime passano
  // sempre dal Reply-To c-<token>@ impostato in uscita.
  console.warn(`[webhook resend] email.received scartata: destinatario senza token (email_id ${data.email_id})`);
  return null;
}

async function handleInbound(data: EmailEventData): Promise<string> {
  const target = await resolveInboundContact(data);
  if (!target) return "ignorato: destinatario non riconosciuto";

  const db = companyDb(target.companyId);
  const existing = await db.message.findUnique({ where: { providerMessageId: data.email_id }, select: { id: true } });
  if (existing) return "received: duplicato";

  // Il webhook porta solo i metadati: il corpo si legge dall'API Receiving.
  let html: string | null = null;
  let text: string | null = null;
  let headers: Record<string, string> | null = null;
  const full = await getResend().emails.receiving.get(data.email_id);
  if (full.error) {
    // Errore transitorio: si lancia, la route risponde 500 e Svix ritenta.
    throw new Error(`Resend receiving.get fallita: ${full.error.message}`);
  }
  html = full.data?.html ?? null;
  text = full.data?.text ?? (html ? htmlToText(html) : null);
  headers = full.data?.headers ?? null;

  const subject = (full.data?.subject ?? data.subject ?? "").slice(0, 500) || null;
  const from = extractEmailAddress(full.data?.from ?? data.from);
  const inReplyTo = headers ? (headers["in-reply-to"] ?? headers["In-Reply-To"] ?? null) : null;
  const attachments = (full.data?.attachments ?? data.attachments ?? []).map(a => ({
    id: a.id,
    filename: a.filename,
    contentType: a.content_type,
  }));
  const when = data.created_at ? new Date(data.created_at) : new Date();
  const receivedAt = Number.isNaN(when.getTime()) ? new Date() : when;

  let message: Message;
  try {
    message = await db.message.create({
      data: {
        companyId: target.companyId,
        contactId: target.id,
        channel: "EMAIL",
        direction: "INBOUND",
        status: "RECEIVED",
        subject,
        bodyText: text ? stripQuotedReply(text) : null,
        bodyHtml: html,
        fromAddress: from,
        toAddress: (data.to ?? [])[0] ?? null,
        providerMessageId: data.email_id,
        inReplyTo,
        attachments: attachments.length ? attachments : undefined,
        createdAt: receivedAt,
      },
    });
  } catch (e) {
    // Consegna concorrente dello stesso evento: l'altra ha gia' scritto.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "received: duplicato";
    throw e;
  }

  await db.contact.update({
    where: { id: target.id },
    data: { unreadCount: { increment: 1 } },
  });
  await db.contact.updateMany({
    where: { id: target.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: receivedAt } }] },
    data: { lastMessageAt: receivedAt },
  });
  await logActivity(db, target.companyId, {
    contactId: target.id,
    type: "EMAIL_RECEIVED",
    data: { messageId: message.id, subject: subject ?? undefined },
    occurredAt: receivedAt,
  });
  return "received";
}
