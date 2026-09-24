import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  authenticateWhatsAppPayload,
  processWhatsAppPayload,
  type WaPayload,
} from "@/lib/crm/messaging/whatsappWebhook";

/**
 * Webhook WhatsApp Cloud API (Meta). Rotta pubblica (proxy.ts): si autentica
 * con la firma X-Hub-Signature-256 calcolata con l'App Secret dell'azienda
 * proprietaria del numero.
 *
 * Un solo URL per tutte le aziende: il payload porta metadata.phone_number_id,
 * che identifica l'integrazione (e quindi l'App Secret con cui verificare).
 */

/** Verifica della sottoscrizione (Meta > WhatsApp > Configurazione > Webhook). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "";

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  const match = expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  if (mode === "subscribe" && match) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  // Body GREZZO: la firma e' sui byte esatti, un JSON ri-serializzato non torna.
  const raw = await req.text();

  let payload: WaPayload;
  try {
    payload = JSON.parse(raw) as WaPayload;
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  if (payload.object && payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true, result: "ignorato" });
  }

  // Il parse sopra serve SOLO a leggere phone_number_id per trovare l'App
  // Secret: nessun dato del payload viene usato o scritto prima della firma.
  const routes = await authenticateWhatsAppPayload(raw, req.headers.get("x-hub-signature-256"), payload);
  if (routes === "invalid") return NextResponse.json({ error: "Firma non valida" }, { status: 401 });
  if (routes.size === 0) return NextResponse.json({ ok: true, result: "nessun numero configurato" });

  try {
    await processWhatsAppPayload(payload, routes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 500 → Meta ritenta; l'elaborazione e' idempotente (unique su wamid).
    console.error("[webhook whatsapp] errore:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Errore temporaneo" }, { status: 500 });
  }
}
