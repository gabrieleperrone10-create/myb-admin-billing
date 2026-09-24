import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveByManageToken, rateLimited, clientIp, requestOrigin } from "@/lib/booking/public";
import { cancelAppointment, rescheduleAppointment } from "@/lib/booking/engine";
import { appBaseUrl } from "@/lib/booking/emails";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), token: z.string().min(1).max(64), reason: z.string().max(500).optional().nullable() }),
  z.object({ action: z.literal("reschedule"), token: z.string().min(1).max(64), startTime: z.iso.datetime() }),
]);

/** POST /api/public/booking/manage — annulla o sposta dal link dell'email (manageToken). */
export async function POST(req: NextRequest) {
  if (rateLimited(`manage:${clientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Troppe richieste, riprova più tardi" }, { status: 429 });
  }
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const b = parsed.data;

  const ctx = await resolveByManageToken(b.token);
  if (!ctx) return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
  const { company, db, appointment } = ctx;
  if (appointment.endTime < new Date()) {
    return NextResponse.json({ error: "L'appuntamento è già passato" }, { status: 400 });
  }
  const baseUrl = appBaseUrl(requestOrigin(req));

  const result = b.action === "cancel"
    ? await cancelAppointment(db, company, appointment, { reason: b.reason, actorUserId: null, baseUrl, byGuest: true })
    : await rescheduleAppointment(db, company, appointment, new Date(b.startTime), { actorUserId: null, baseUrl, byGuest: true });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ok: true,
    appointment: {
      status: result.value.status,
      startTime: result.value.startTime.toISOString(),
      endTime: result.value.endTime.toISOString(),
      videoLink: result.value.videoLink,
    },
  });
}
