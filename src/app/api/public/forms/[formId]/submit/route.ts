import { basePrisma, companyDb } from "@/lib/db";
import { corsJson, corsPreflight } from "@/lib/crm/forms/cors";
import { checkRateLimit, clientIp } from "@/lib/crm/forms/rateLimit";
import { HONEYPOT_FIELD } from "@/lib/crm/forms/shared";
import { readSubmitBody, processFormSubmission } from "@/lib/crm/forms/submission";
import type { FormField, FormSettings } from "@/lib/crm/types";

/**
 * Invio pubblico di un form ospitato. Raggiungibile da QUALUNQUE sito che
 * incorpori il form (iframe o fetch diretto): niente sessione, niente
 * cookie, CORS aperto. L'unica cosa fidata e' il record Form nel database,
 * risolto dal suo id — non un solo valore proveniente dal body della
 * richiesta.
 *
 * force-dynamic: legge dal database a ogni chiamata, non deve mai essere
 * servita dalla cache dei Route Handler.
 */
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;

  // basePrisma: risolve l'azienda da un identificativo pubblico (l'id del
  // form nell'URL, non fidato). Da qui in poi si passa a companyDb(companyId).
  const form = await basePrisma.form.findUnique({ where: { id: formId } });
  if (!form || !form.active) {
    return corsJson({ ok: false, error: "Form non disponibile" }, 404);
  }

  const parsed = await readSubmitBody(req);
  if (!parsed.ok) {
    return corsJson({ ok: false, error: parsed.error }, 400);
  }
  const { body } = parsed;

  const settings = (form.settings ?? {}) as FormSettings;

  // Honeypot: un bot che compila ogni campo lo valorizza. Risposta 200 finta,
  // identica a un invio riuscito, senza scrivere nulla — cosi' lo script che
  // lo compila non impara a distinguere "bloccato" da "andato a buon fine".
  const hp = body[HONEYPOT_FIELD];
  if (typeof hp === "string" && hp.trim() !== "") {
    return corsJson({ ok: true, message: settings.successMessage, redirectUrl: settings.redirectUrl });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`submit:${form.id}:${ip}`, { windowMs: 60_000, max: 12 })) {
    return corsJson({ ok: false, error: "Troppi invii, riprova tra qualche minuto" }, 429);
  }

  const db = companyDb(form.companyId);
  const fields = (form.fields ?? []) as unknown as FormField[];
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  try {
    const result = await processFormSubmission(db, form.companyId, form, fields, settings, body, userAgent);
    if (!result.ok) {
      return corsJson({ ok: false, error: result.error, errors: result.errors }, result.status);
    }
    return corsJson({ ok: true, message: result.message, redirectUrl: result.redirectUrl });
  } catch (e) {
    // mai propagare uno stack trace al chiamante pubblico
    console.error("[api/public/forms/submit] errore inatteso", { formId: form.id }, e);
    return corsJson({ ok: false, error: "Errore imprevisto, riprova" }, 400);
  }
}
