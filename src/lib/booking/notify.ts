import "server-only";
import { Prisma, type Appointment, type Calendar, type Company, type NotificationChannel, type NotificationKind } from "@prisma/client";
import { Resend } from "resend";
import type { CompanyDb } from "@/lib/db";
import { companyMailIdentity } from "@/lib/cron";
import { listCompanyMembers } from "@/lib/crm/members";
import { buildGuestEmail, buildHostEmail, type BuiltEmail } from "./emails";

/**
 * Invio delle notifiche di prenotazione dietro un'interfaccia di canale
 * (portata da Nutrizionisti-app `src/lib/notifications/channels`).
 *
 * EMAIL e' implementato con Resend e il mittente dell'azienda. WHATSAPP per
 * ora risponde "non configurato": l'aggancio a lib/crm/messaging/whatsapp.ts
 * si fa all'integrazione riscrivendo SOLO `whatsappChannel.send` qui sotto.
 *
 * Idempotenza: prima di inviare si "prenota" la riga NotificationLog
 * (unique appointmentId+kind+channel+offsetMinutes). Se esiste gia', non si
 * invia: due esecuzioni concorrenti del cron o un doppio click non mandano
 * due email. L'esito (ok/errore) si scrive sulla stessa riga dopo l'invio.
 */

export type ChannelSendResult = { ok: true; id?: string } | { ok: false; error: string };

export type NotifyContext = {
  company: Company;
  appointment: Appointment;
  calendar: Calendar;
  kind: NotificationKind;
  offsetMinutes: number;
  baseUrl: string;
};

export interface BookingChannel {
  id: NotificationChannel;
  label: string;
  isConfigured(): boolean;
  recipient(appt: Pick<Appointment, "guestEmail" | "guestPhone">): string | null;
  send(to: string, ctx: NotifyContext): Promise<ChannelSendResult>;
}

let resendClient: Resend | null = null;
function resend(): Resend {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendEmail(
  company: Company,
  to: string,
  email: BuiltEmail,
): Promise<ChannelSendResult> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY non impostata" };
  const { fromName, fromEmail, replyTo } = companyMailIdentity(company);
  if (!fromEmail) return { ok: false, error: "Mittente email dell'azienda non configurato" };
  try {
    const { data, error } = await resend().emails.send({
      from: `${fromName} <${fromEmail}>`,
      ...(replyTo ? { replyTo } : {}),
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.ics
        ? { attachments: [{ filename: "appuntamento.ics", content: Buffer.from(email.ics).toString("base64"), contentType: "text/calendar" }] }
        : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export const emailChannel: BookingChannel = {
  id: "EMAIL",
  label: "Email",
  isConfigured: () => !!process.env.RESEND_API_KEY,
  recipient: a => a.guestEmail || null,
  async send(to, ctx) {
    const email = buildGuestEmail(ctx.kind, ctx.appointment, ctx.calendar, ctx.company, ctx.baseUrl, { offsetMinutes: ctx.offsetMinutes });
    return sendEmail(ctx.company, to, email);
  },
};

export const whatsappChannel: BookingChannel = {
  id: "WHATSAPP",
  label: "WhatsApp",
  // TODO integrazione: usare lib/crm/messaging/whatsapp.ts (template approvato)
  isConfigured: () => false,
  recipient: a => a.guestPhone || null,
  async send() {
    return { ok: false, error: "WhatsApp non configurato" };
  },
};

export const CHANNELS: Record<NotificationChannel, BookingChannel> = {
  EMAIL: emailChannel,
  WHATSAPP: whatsappChannel,
};

/**
 * Invia una notifica al contatto una sola volta per (appuntamento, tipo,
 * canale, offset). Non lancia mai: restituisce l'esito.
 * `skipped` = gia' inviata (o in corso) da un'altra esecuzione.
 */
export async function notifyGuest(
  db: CompanyDb,
  params: Omit<NotifyContext, "offsetMinutes"> & { channel?: NotificationChannel; offsetMinutes?: number },
): Promise<ChannelSendResult | { ok: true; skipped: true }> {
  const channel = CHANNELS[params.channel ?? "EMAIL"];
  const offsetMinutes = params.offsetMinutes ?? 0;
  const to = channel.recipient(params.appointment);

  let logId: string;
  try {
    const log = await db.notificationLog.create({
      data: {
        companyId: params.company.id,
        appointmentId: params.appointment.id,
        kind: params.kind,
        channel: channel.id,
        offsetMinutes,
        ok: false,
        error: "in corso",
      },
    });
    logId = log.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, skipped: true };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  let result: ChannelSendResult;
  if (!to) result = { ok: false, error: `Nessun destinatario per ${channel.label}` };
  else if (!channel.isConfigured()) result = { ok: false, error: `${channel.label} non configurato` };
  else result = await channel.send(to, { ...params, offsetMinutes });

  try {
    await db.notificationLog.update({
      where: { id: logId },
      data: { ok: result.ok, error: result.ok ? null : result.error.slice(0, 500), sentAt: new Date() },
    });
  } catch { /* il log non deve far fallire l'invio */ }
  return result;
}

/** Email interna all'host dell'appuntamento. Best effort, mai lancia. */
export async function notifyHost(
  event: "BOOKED" | "RESCHEDULED" | "CANCELLED",
  params: { company: Company; appointment: Appointment; calendar: Calendar; baseUrl: string },
): Promise<void> {
  try {
    const members = await listCompanyMembers(params.company.id);
    const host = members.find(m => m.userId === params.appointment.hostUserId);
    const to = host?.email;
    if (!to) return;
    const email = buildHostEmail(event, params.appointment, params.calendar, params.company, params.baseUrl, params.company.slug);
    const r = await sendEmail(params.company, to, email);
    if (!r.ok) console.error("[booking] notifica host non inviata:", r.error);
  } catch (e) {
    console.error("[booking] notifica host:", e);
  }
}
