import { NextRequest, NextResponse } from "next/server";
import { resolvePublicCalendar, resolveByManageToken, rateLimited, clientIp } from "@/lib/booking/public";
import { availableSlots } from "@/lib/booking/engine";
import { groupSlotsByDay, isValidDateStr, isValidTimeZone, zonedRange, addDaysStr } from "@/lib/booking/slots";

/**
 * GET /api/public/booking/slots?company=&calendar=&from=YYYY-MM-DD&to=YYYY-MM-DD&tz=&token=
 *
 * Solo orari liberi, raggruppati per giorno nel fuso del visitatore (`tz`).
 * Nessun dato di altri appuntamenti esce da qui. `token` (manageToken) serve
 * allo spostamento: l'appuntamento che si sposta non occupa i propri orari.
 */
export async function GET(req: NextRequest) {
  if (rateLimited(`slots:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: "Troppe richieste, riprova tra poco" }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const companySlug = sp.get("company") ?? "";
  const calendarSlug = sp.get("calendar") ?? "";
  const from = sp.get("from");
  const to = sp.get("to");
  const tzParam = sp.get("tz");

  if (!isValidDateStr(from) || !isValidDateStr(to) || to < from || addDaysStr(from, 62) < to) {
    return NextResponse.json({ error: "Intervallo di date non valido" }, { status: 400 });
  }

  const ctx = await resolvePublicCalendar(companySlug, calendarSlug);
  if (!ctx) return NextResponse.json({ error: "Calendario non trovato" }, { status: 404 });
  const { company, db, calendar } = ctx;
  const tz = isValidTimeZone(tzParam) ? tzParam : calendar.timezone;

  let exclude = null;
  const token = sp.get("token");
  if (token) {
    const m = await resolveByManageToken(token);
    if (m && m.company.id === company.id && m.appointment.calendarId === calendar.id) exclude = m.appointment;
  }

  const { start, end } = zonedRange(from, to, tz);
  const slots = await availableSlots(db, company.id, calendar, start, end, { exclude });

  return NextResponse.json(
    { timezone: tz, calendarTimezone: calendar.timezone, durationMinutes: calendar.durationMinutes, days: groupSlotsByDay(slots, tz) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
