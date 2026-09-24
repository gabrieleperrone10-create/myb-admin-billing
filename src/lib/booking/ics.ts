/**
 * Generazione .ics (RFC 5545) per "aggiungi al calendario". Puro.
 * Orari in UTC (suffisso Z): nessuna VTIMEZONE necessaria.
 */

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Spezza le righe oltre 75 ottetti (approssimato a caratteri). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(ev: {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  organizerName?: string;
  organizerEmail?: string;
  url?: string;
  cancelled?: boolean;
  sequence?: number;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CRM//Booking//IT",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence ?? 0}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(ev.start)}`,
    `DTEND:${icsDate(ev.end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    ...(ev.url ? [`URL:${ev.url}`] : []),
    ...(ev.organizerEmail ? [`ORGANIZER;CN=${esc(ev.organizerName ?? ev.organizerEmail)}:mailto:${ev.organizerEmail}`] : []),
    `STATUS:${ev.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Link "aggiungi a Google Calendar" (niente login lato nostro). */
export function googleCalendarTemplateUrl(ev: { title: string; start: Date; end: Date; details?: string; location?: string }): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsDate(ev.start)}/${icsDate(ev.end)}`,
    ...(ev.details ? { details: ev.details } : {}),
    ...(ev.location ? { location: ev.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
