import { NextResponse } from "next/server";
import { verifySvixSignature } from "@/lib/crm/messaging/signatures";
import { handleResendEvent, type ResendEvent } from "@/lib/crm/messaging/resendWebhook";

/**
 * Webhook Resend (Svix): stati delle email CRM + email in entrata.
 *
 * Rotta pubblica (proxy.ts: /api/webhooks/(.*)), niente sessione: l'unica
 * autenticazione e' la firma. Il body va letto come testo GREZZO prima di
 * qualunque parse, perche' la firma e' calcolata sui byte esatti.
 *
 * Risposte: 401 firma non valida (nessuna scrittura), 200 evento gestito o
 * ignorato, 500 errore transitorio (Svix ritenta; l'elaborazione e'
 * idempotente).
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook resend] RESEND_WEBHOOK_SECRET non impostata");
    return NextResponse.json({ error: "Webhook non configurato" }, { status: 503 });
  }

  const raw = await req.text();
  const ok = verifySvixSignature({
    payload: raw,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    secret,
  });
  if (!ok) return NextResponse.json({ error: "Firma non valida" }, { status: 401 });

  let evt: ResendEvent;
  try {
    evt = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  try {
    const result = await handleResendEvent(evt);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error(`[webhook resend] errore su ${evt.type}:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Errore temporaneo" }, { status: 500 });
  }
}
