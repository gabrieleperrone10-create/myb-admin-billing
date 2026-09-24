import type { Appointment, Calendar, Company, NotificationKind } from "@prisma/client";
import { companyDisplayName } from "@/lib/company";
import { formatDateTimeLong, locationText, manageBookingPath } from "./shared";
import { buildIcs } from "./ics";

/**
 * Testi delle email di prenotazione (conferma, promemoria, spostamento,
 * annullamento) e della notifica all'host. Tutto l'input dell'utente passa da
 * esc(): nome, risposte e motivi sono scritti da chi prenota.
 */

export function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function appBaseUrl(origin?: string | null): string {
  return (process.env.NEXT_PUBLIC_APP_URL || origin || "").replace(/\/+$/, "");
}

type Appt = Pick<Appointment, "id" | "title" | "startTime" | "endTime" | "guestName" | "videoLink" | "manageToken" | "cancelReason" | "rescheduledCount" | "answers">;
type Cal = Pick<Calendar, "name" | "timezone" | "locationType" | "locationValue" | "durationMinutes">;
type Co = Pick<Company, "name" | "brandName" | "brandColor" | "logoUrl" | "email" | "phone" | "website">;

export type BuiltEmail = { subject: string; html: string; text: string; ics?: string };

function layout(company: Co, badge: string, body: string): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(company.brandColor) ? company.brandColor : "#4f7deb";
  const name = esc(companyDisplayName(company));
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="border-bottom:3px solid ${color};padding-bottom:16px;margin-bottom:24px;">
    ${company.logoUrl ? `<img src="${esc(company.logoUrl)}" alt="${name}" style="max-height:40px;max-width:200px;">` : `<span style="font-size:20px;font-weight:700;color:${color};">${name}</span>`}
  </div>
  <div style="background:${color}1a;border-radius:8px;padding:8px 14px;margin-bottom:20px;display:inline-block;">
    <span style="font-size:13px;font-weight:600;color:${color};">${esc(badge)}</span>
  </div>
  ${body}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:11px;color:#9ca3af;">${[company.email, company.phone, company.website].filter(Boolean).map(esc).join(" · ")}</p>
</body></html>`;
}

function detailsBox(appt: Appt, cal: Cal, company: Co): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(company.brandColor) ? company.brandColor : "#4f7deb";
  const loc = locationText(cal.locationType, cal.locationValue, appt.videoLink);
  const link = appt.videoLink
    ? `<p style="margin:10px 0 0;"><a href="${esc(appt.videoLink)}" style="display:inline-block;background:${color};color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:14px;">Partecipa alla videochiamata</a></p>`
    : "";
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
    <p style="margin:4px 0;font-size:15px;"><strong>${esc(cal.name)}</strong></p>
    <p style="margin:4px 0;font-size:14px;color:#374151;">${esc(formatDateTimeLong(appt.startTime, cal.timezone))} (${esc(cal.timezone)}) · ${cal.durationMinutes} min</p>
    <p style="margin:4px 0;font-size:14px;color:#374151;">${esc(loc)}</p>
    ${link}
  </div>`;
}

function manageLine(appt: Appt, baseUrl: string): string {
  if (!baseUrl) return "";
  const url = `${baseUrl}${manageBookingPath(appt.manageToken)}`;
  return `<p style="color:#4b5563;font-size:14px;line-height:1.6;">Devi spostare o annullare? <a href="${esc(url)}">Gestisci la prenotazione</a>.</p>`;
}

function icsFor(appt: Appt, cal: Cal, company: Co, baseUrl: string, cancelled = false): string {
  return buildIcs({
    uid: `${appt.id}@booking`,
    title: `${cal.name} — ${companyDisplayName(company)}`,
    description: baseUrl ? `Gestisci la prenotazione: ${baseUrl}${manageBookingPath(appt.manageToken)}` : undefined,
    location: appt.videoLink ?? cal.locationValue ?? undefined,
    start: appt.startTime,
    end: appt.endTime,
    sequence: appt.rescheduledCount + (cancelled ? 1 : 0),
    cancelled,
  });
}

/** Email al contatto per il tipo di notifica. */
export function buildGuestEmail(
  kind: NotificationKind,
  appt: Appt,
  cal: Cal,
  company: Co,
  baseUrl: string,
  opts: { offsetMinutes?: number } = {},
): BuiltEmail {
  const who = esc(appt.guestName?.split(" ")[0] || "");
  const hello = `<p style="font-size:16px;margin-bottom:8px;">Ciao${who ? ` ${who}` : ""},</p>`;
  const when = formatDateTimeLong(appt.startTime, cal.timezone);
  const brand = companyDisplayName(company);

  switch (kind) {
    case "CONFIRMATION":
      return {
        subject: `Confermato: ${cal.name} — ${when}`,
        html: layout(company, "PRENOTAZIONE CONFERMATA", `${hello}
          <p style="color:#4b5563;line-height:1.6;">la tua prenotazione con <strong>${esc(brand)}</strong> è confermata.</p>
          ${detailsBox(appt, cal, company)}${manageLine(appt, baseUrl)}`),
        text: `La tua prenotazione "${cal.name}" è confermata per ${when} (${cal.timezone}).`,
        ics: icsFor(appt, cal, company, baseUrl),
      };
    case "REMINDER": {
      const off = opts.offsetMinutes ?? 0;
      const rel = off >= 1440 && off % 1440 === 0 ? `${off / 1440} ${off === 1440 ? "giorno" : "giorni"}`
        : off >= 60 && off % 60 === 0 ? `${off / 60} ${off === 60 ? "ora" : "ore"}` : `${off} minuti`;
      return {
        subject: `Promemoria: ${cal.name} — ${when}`,
        html: layout(company, "PROMEMORIA APPUNTAMENTO", `${hello}
          <p style="color:#4b5563;line-height:1.6;">ti ricordiamo l'appuntamento con <strong>${esc(brand)}</strong>${off ? ` (tra circa ${rel})` : ""}.</p>
          ${detailsBox(appt, cal, company)}${manageLine(appt, baseUrl)}`),
        text: `Promemoria: "${cal.name}" il ${when} (${cal.timezone}).`,
      };
    }
    case "RESCHEDULE":
      return {
        subject: `Spostato: ${cal.name} — ${when}`,
        html: layout(company, "APPUNTAMENTO SPOSTATO", `${hello}
          <p style="color:#4b5563;line-height:1.6;">il tuo appuntamento con <strong>${esc(brand)}</strong> è stato spostato. Ecco il nuovo orario:</p>
          ${detailsBox(appt, cal, company)}${manageLine(appt, baseUrl)}`),
        text: `Il tuo appuntamento "${cal.name}" è stato spostato a ${when} (${cal.timezone}).`,
        ics: icsFor(appt, cal, company, baseUrl),
      };
    case "CANCELLATION":
      return {
        subject: `Annullato: ${cal.name} — ${when}`,
        html: layout(company, "APPUNTAMENTO ANNULLATO", `${hello}
          <p style="color:#4b5563;line-height:1.6;">l'appuntamento con <strong>${esc(brand)}</strong> del <strong>${esc(when)}</strong> è stato annullato.</p>
          ${appt.cancelReason ? `<p style="color:#4b5563;line-height:1.6;">Motivo: ${esc(appt.cancelReason)}</p>` : ""}`),
        text: `L'appuntamento "${cal.name}" del ${when} è stato annullato.`,
        ics: icsFor(appt, cal, company, baseUrl, true),
      };
  }
}

/** Notifica interna all'host (nuova prenotazione / spostamento / annullamento dal link). */
export function buildHostEmail(
  event: "BOOKED" | "RESCHEDULED" | "CANCELLED",
  appt: Appt & { guestEmail: string | null; guestPhone: string | null; contactId: string },
  cal: Cal,
  company: Co,
  baseUrl: string,
  companySlug: string,
): BuiltEmail {
  const when = formatDateTimeLong(appt.startTime, cal.timezone);
  const label = event === "BOOKED" ? "NUOVA PRENOTAZIONE" : event === "RESCHEDULED" ? "PRENOTAZIONE SPOSTATA" : "PRENOTAZIONE ANNULLATA";
  const answers = Object.entries((appt.answers ?? {}) as Record<string, unknown>)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `<p style="margin:4px 0;font-size:14px;color:#374151;">${esc(k)}: <strong>${esc(Array.isArray(v) ? v.join(", ") : String(v ?? ""))}</strong></p>`)
    .join("");
  const contactUrl = baseUrl ? `${baseUrl}/${companySlug}/contacts/${appt.contactId}?tab=appointments` : "";
  return {
    subject: `[${cal.name}] ${label.toLowerCase()}: ${appt.guestName ?? "contatto"} — ${when}`,
    html: layout(company, label, `
      <p style="font-size:15px;"><strong>${esc(appt.guestName)}</strong>${appt.guestEmail ? ` · ${esc(appt.guestEmail)}` : ""}${appt.guestPhone ? ` · ${esc(appt.guestPhone)}` : ""}</p>
      ${detailsBox(appt, cal, company)}
      ${appt.cancelReason && event === "CANCELLED" ? `<p style="color:#4b5563;">Motivo: ${esc(appt.cancelReason)}</p>` : ""}
      ${answers ? `<div style="margin:16px 0;">${answers}</div>` : ""}
      ${contactUrl ? `<p><a href="${esc(contactUrl)}">Apri il contatto nel CRM →</a></p>` : ""}`),
    text: `${label}: ${appt.guestName ?? ""} — ${cal.name} — ${when}`,
  };
}
