import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolvePublicCalendar, rateLimited, clientIp, requestOrigin } from "@/lib/booking/public";
import { bookAppointment } from "@/lib/booking/engine";
import { appBaseUrl } from "@/lib/booking/emails";
import { UTM_KEYS, type Attribution } from "@/lib/crm/types";

const bodySchema = z.object({
  company: z.string().min(1).max(60),
  calendar: z.string().min(1).max(80),
  startTime: z.iso.datetime(),
  firstName: z.string().trim().min(1, "Il nome è obbligatorio").max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("Email non valida").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  answers: z.record(z.string(), z.unknown()).optional(),
  visitorId: z.string().max(100).optional().nullable(),
  attribution: z.record(z.string(), z.unknown()).optional().nullable(),
  /** honeypot: i bot lo compilano */
  website: z.string().optional(),
});

function cleanAttribution(raw: Record<string, unknown> | null | undefined): Attribution | null {
  if (!raw) return null;
  const out: Attribution = {};
  for (const k of [...UTM_KEYS, "referrer", "landingUrl"] as const) {
    const v = raw[k];
    if (typeof v === "string" && v) out[k] = v.slice(0, 500);
  }
  if (!Object.keys(out).length) return null;
  out.at = new Date().toISOString();
  return out;
}

/** POST /api/public/booking/book — prenotazione dalla pagina pubblica. */
export async function POST(req: NextRequest) {
  if (rateLimited(`book:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Troppe prenotazioni da questo indirizzo, riprova più tardi" }, { status: 429 });
  }

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  const b = parsed.data;
  if (b.website) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });

  const ctx = await resolvePublicCalendar(b.company, b.calendar);
  if (!ctx) return NextResponse.json({ error: "Calendario non trovato" }, { status: 404 });

  const result = await bookAppointment(ctx.db, ctx.company, ctx.calendar, {
    origin: "public",
    startTime: new Date(b.startTime),
    guest: { firstName: b.firstName, lastName: b.lastName, email: b.email, phone: b.phone },
    answers: b.answers,
    notes: b.notes,
    visitorId: b.visitorId,
    attribution: cleanAttribution(b.attribution as Record<string, unknown> | null | undefined),
    actorUserId: null,
    baseUrl: appBaseUrl(requestOrigin(req)),
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const a = result.value;
  // Solo cio' che serve alla pagina di conferma di chi ha prenotato.
  return NextResponse.json({
    ok: true,
    appointment: {
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
      videoLink: a.videoLink,
      manageToken: a.manageToken,
    },
  });
}
