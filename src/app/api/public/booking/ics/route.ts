import { NextRequest, NextResponse } from "next/server";
import { resolveByManageToken, requestOrigin, rateLimited, clientIp } from "@/lib/booking/public";
import { buildIcs } from "@/lib/booking/ics";
import { manageBookingPath } from "@/lib/booking/shared";
import { appBaseUrl } from "@/lib/booking/emails";
import { companyDisplayName } from "@/lib/company";

/** GET /api/public/booking/ics?token= — file .ics dell'appuntamento ("aggiungi al calendario"). */
export async function GET(req: NextRequest) {
  if (rateLimited(`ics:${clientIp(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Troppe richieste, riprova tra poco" }, { status: 429 });
  }
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const ctx = await resolveByManageToken(token);
  if (!ctx) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  const { company, appointment: a } = ctx;
  const base = appBaseUrl(requestOrigin(req));
  const ics = buildIcs({
    uid: `${a.id}@booking`,
    title: `${a.calendar.name} — ${companyDisplayName(company)}`,
    description: `Gestisci la prenotazione: ${base}${manageBookingPath(a.manageToken)}`,
    location: a.videoLink ?? a.calendar.locationValue ?? undefined,
    start: a.startTime,
    end: a.endTime,
    sequence: a.rescheduledCount,
    cancelled: a.status === "CANCELLED",
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appuntamento.ics"',
      "Cache-Control": "no-store",
    },
  });
}
