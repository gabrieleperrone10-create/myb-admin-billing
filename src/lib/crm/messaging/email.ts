import "server-only";
import { Resend } from "resend";
import type { CompanyDb } from "@/lib/db";
import { companyMailIdentity } from "@/lib/cron";
import { inboundDomainFor, platformInboundDomain } from "@/lib/email/identity";
import { logActivity } from "@/lib/crm/activity";
import { htmlToText, replyAddressFor } from "./signatures";

/**
 * Email 1:1 dal CRM verso un contatto (Resend).
 *
 * Mittente: lo stesso di mail.ts (companyMailIdentity: emailFromName /
 * emailFromAddress / emailReplyTo dell'azienda, con fallback alle env).
 *
 * Reply-To: `c-<contact.replyToken>@INBOUND_EMAIL_DOMAIN`. Quando il contatto
 * risponde, la mail arriva a Resend Inbound, il webhook email.received legge
 * il token dal destinatario e la aggancia al contatto giusto (e all'azienda
 * giusta: il token e' globalmente unico). Se INBOUND_EMAIL_DOMAIN manca si usa
 * il replyTo dell'azienda: l'invio funziona, ma le risposte finiscono nella
 * casella dell'azienda e NON tornano nel thread del CRM.
 *
 * Tracking aperture/click: l'API di invio di Resend NON ha un'opzione per
 * singola email; si attiva a livello di dominio (Resend > Domains > <dominio>
 * > Configuration > Click tracking / Open tracking). Gli eventi arrivano poi
 * al webhook come email.opened / email.clicked.
 */

let client: Resend | null = null;
export function getResend(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

/** Dominio di ricezione condiviso della piattaforma (riserva). Per azienda: inboundDomainFor(). */
export function inboundEmailDomain(): string | null {
  return platformInboundDomain();
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string; messageId?: string };

export async function sendContactEmail(
  db: CompanyDb,
  companyId: string,
  params: { contactId: string; subject: string; html: string; text?: string; sentByUserId?: string | null },
): Promise<SendResult> {
  const [contact, company] = await Promise.all([
    db.contact.findUnique({
      where: { id: params.contactId },
      select: { id: true, email: true, emailOptOut: true, replyToken: true },
    }),
    // Company non e' un modello tenant: il filtro e' l'id stesso.
    db.company.findUnique({ where: { id: companyId } }),
  ]);
  if (!contact || !company) return { ok: false, error: "Contatto non trovato" };
  if (!contact.email) return { ok: false, error: "Il contatto non ha un indirizzo email" };
  if (contact.emailOptOut) return { ok: false, error: "Il contatto ha chiesto di non ricevere email" };

  const subject = params.subject.trim();
  if (!subject) return { ok: false, error: "Oggetto obbligatorio" };

  const { fromName, fromEmail, replyTo: companyReplyTo } = companyMailIdentity(company);
  if (!fromEmail) return { ok: false, error: "Mittente email dell'azienda non configurato" };
  // Sottodominio di ricezione dell'azienda se verificato, altrimenti quello condiviso.
  const domain = inboundDomainFor(company);
  const replyTo = domain ? replyAddressFor(contact.replyToken, domain) : companyReplyTo || undefined;
  const text = params.text ?? htmlToText(params.html);

  // Riga creata PRIMA dell'invio: se il processo muore a meta' resta traccia,
  // e l'id diventa la chiave di idempotenza verso Resend (un retry della
  // stessa riga non manda due email).
  const message = await db.message.create({
    data: {
      companyId,
      contactId: contact.id,
      channel: "EMAIL",
      direction: "OUTBOUND",
      status: "QUEUED",
      subject,
      bodyHtml: params.html,
      bodyText: text,
      fromAddress: fromEmail,
      toAddress: contact.email,
      sentByUserId: params.sentByUserId ?? null,
    },
  });

  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const res = await getResend().emails.send(
      {
        from: `${fromName} <${fromEmail}>`,
        to: [contact.email],
        replyTo,
        subject,
        html: params.html,
        text,
        // Fallback per il webhook se l'evento arrivasse prima dell'update
        // con providerMessageId (vedi api/webhooks/resend).
        tags: [
          { name: "crm_company", value: companyId },
          { name: "crm_message", value: message.id },
        ],
      },
      { idempotencyKey: `crm-msg-${message.id}` },
    );
    if (res.error) error = res.error.message;
    else providerId = res.data?.id ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const now = new Date();
  await db.message.update({
    where: { id: message.id },
    data: error
      ? { status: "FAILED", error }
      : { status: "SENT", providerMessageId: providerId },
  });
  if (error) return { ok: false, error, messageId: message.id };

  await db.contact.updateMany({
    where: { id: contact.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: now } }] },
    data: { lastMessageAt: now },
  });
  await logActivity(db, companyId, {
    contactId: contact.id,
    type: "EMAIL_SENT",
    data: { messageId: message.id, subject },
    actorUserId: params.sentByUserId ?? null,
    occurredAt: now,
  });
  return { ok: true, messageId: message.id };
}
