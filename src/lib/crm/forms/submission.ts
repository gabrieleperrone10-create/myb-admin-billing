import "server-only";
import { Prisma, type CustomFieldDef, type Form } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { coerceFieldValue, type CustomFieldValue } from "@/lib/crm/customFields";
import { upsertContact, normalizeEmail, normalizePhone } from "@/lib/crm/contacts";
import { createOpportunity } from "@/lib/crm/opportunities";
import { logActivity } from "@/lib/crm/activity";
import { identifyVisitor } from "@/lib/crm/tracking/identify";
import type { Attribution, FormField, FormSettings } from "@/lib/crm/types";
import {
  MAX_SUBMIT_PAYLOAD_BYTES, MAX_URL_LENGTH, MAX_ATTRIBUTION_FIELD_LENGTH,
  stdKeyOf, cfKeyOf,
} from "./shared";

const UTM_AND_ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid",
] as const;

export type SubmitBody = Record<string, unknown>;

/**
 * Legge il body della richiesta (JSON o form-urlencoded), con limite di
 * dimensione applicato PRIMA del parsing: un payload enorme non deve far
 * lavorare JSON.parse/URLSearchParams su decine di MB prima di essere
 * scartato.
 */
export async function readSubmitBody(
  req: Request,
  maxBytes = MAX_SUBMIT_PAYLOAD_BYTES,
): Promise<{ ok: true; body: SubmitBody } | { ok: false; error: string }> {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return { ok: false, error: "Richiesta troppo grande" };
  }
  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const parsed = raw ? JSON.parse(raw) : {};
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, error: "Corpo della richiesta non valido" };
      }
      return { ok: true, body: parsed as SubmitBody };
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      const body: SubmitBody = {};
      for (const key of params.keys()) {
        const values = params.getAll(key);
        body[key] = values.length > 1 ? values : values[0];
      }
      return { ok: true, body };
    }
    // Content-Type assente/sconosciuto: tenta comunque JSON (fetch senza header espliciti
    // di form embeddati "leggeri" capita), altrimenti errore esplicito.
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw);
      return { ok: true, body: parsed as SubmitBody };
    }
    return { ok: false, error: "Content-Type non supportato: usa JSON o form-urlencoded" };
  } catch {
    return { ok: false, error: "Corpo della richiesta non leggibile" };
  }
}

function truncate(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
}

/** Estrae l'attribuzione (UTM/referrer/landing) dai campi riservati di primo livello del body. */
export function buildAttribution(body: SubmitBody): Attribution | null {
  const attr: Attribution = {};
  for (const k of UTM_AND_ATTRIBUTION_KEYS) {
    const v = truncate(body[k], MAX_ATTRIBUTION_FIELD_LENGTH);
    if (v) attr[k] = v;
  }
  const referrer = truncate(body.referrer, MAX_URL_LENGTH);
  if (referrer) attr.referrer = referrer;
  const landingUrl = truncate(body.landingUrl ?? body.pageUrl, MAX_URL_LENGTH);
  if (landingUrl) attr.landingUrl = landingUrl;
  if (Object.keys(attr).length === 0) return null;
  attr.at = new Date().toISOString();
  return attr;
}

export type SubmitResult =
  | { ok: true; message?: string; redirectUrl?: string }
  | { ok: false; status: number; errors?: Record<string, string>; error?: string };

/**
 * Elabora un invio gia' passato dal controllo honeypot/rate-limit. Fa tutto
 * quello che serve: validazione per campo, upsert del contatto, submission,
 * etichette, opportunita', attivita', identificazione del visitatore.
 *
 * Non fidarsi mai di id/valori dal client per QUALI tag/pipeline/proprietario
 * usare: quelli arrivano da `form.settings`, salvati dall'azienda lato admin,
 * mai dal corpo della richiesta pubblica.
 */
export async function processFormSubmission(
  db: CompanyDb,
  companyId: string,
  form: Pick<Form, "id" | "name" | "companyId">,
  fields: FormField[],
  settings: FormSettings,
  body: SubmitBody,
  userAgent: string | null,
): Promise<SubmitResult> {
  const cfDefs = await db.customFieldDef.findMany({ where: { entity: "CONTACT" } });
  const cfDefByKey = new Map<string, CustomFieldDef>(cfDefs.map(d => [d.key, d]));

  const errors: Record<string, string> = {};
  const data: Record<string, CustomFieldValue> = {};
  const stdValues: Record<string, string> = {};
  const cfValues: Record<string, CustomFieldValue> = {};

  for (const field of fields) {
    const raw = body[field.id];
    const cfKey = cfKeyOf(field.mapTo);
    const liveDef = cfKey ? cfDefByKey.get(cfKey) : undefined;

    // Se il campo e' collegato a un campo personalizzato ancora esistente, si
    // valida contro la SUA definizione live (tipo/opzioni/obbligatorieta'
    // possono essere cambiati dopo la creazione del form) invece della copia
    // congelata nel form. Altrimenti si usa la definizione del campo stesso.
    const def = liveDef
      ? { type: liveDef.type, options: Array.isArray(liveDef.options) ? (liveDef.options as unknown[]).map(String) : [], required: liveDef.required, label: liveDef.label }
      : { type: field.type, options: field.options ?? [], required: field.required, label: field.label };

    const result = coerceFieldValue(def, raw);
    if (!result.ok) {
      errors[field.id] = result.error;
      continue;
    }
    data[field.id] = result.value;

    const stdKey = stdKeyOf(field.mapTo);
    if (stdKey && typeof result.value === "string") stdValues[stdKey] = result.value;
    if (cfKey && liveDef) cfValues[cfKey] = result.value;
  }

  const email = normalizeEmail(stdValues.email);
  const phone = normalizePhone(stdValues.phone);
  const whatsapp = normalizePhone(stdValues.whatsapp);
  if (!email && !phone && !whatsapp) {
    const identifyingField = fields.find(f => {
      const k = stdKeyOf(f.mapTo);
      return k === "email" || k === "phone" || k === "whatsapp";
    });
    if (identifyingField) errors[identifyingField.id] = `${identifyingField.label}: inserisci un valore valido per essere ricontattato`;
    else errors._form = "Inserisci un contatto valido (email o telefono)";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, status: 400, errors };
  }

  const attribution = buildAttribution(body);
  const visitorId = truncate(body.vid, 100) ?? null;
  const pageUrl = truncate(body.pageUrl, MAX_URL_LENGTH) ?? null;

  try {
    const { contact } = await upsertContact(db, companyId, {
      email: stdValues.email ?? null,
      phone: stdValues.phone ?? null,
      whatsapp: stdValues.whatsapp ?? null,
      firstName: stdValues.firstName ?? null,
      lastName: stdValues.lastName ?? null,
      companyName: stdValues.companyName ?? null,
      jobTitle: stdValues.jobTitle ?? null,
      source: `form:${form.id}`,
      ownerUserId: settings.ownerUserId ?? null,
      attribution,
      customFields: cfValues,
    }, { untrusted: true });

    const submission = await db.formSubmission.create({
      data: {
        companyId,
        formId: form.id,
        contactId: contact.id,
        data: data as unknown as Prisma.InputJsonValue,
        attribution: attribution ? (attribution as Prisma.InputJsonValue) : Prisma.JsonNull,
        pageUrl,
        visitorId,
        userAgent,
      },
    });

    for (const tagId of settings.tagIds ?? []) {
      const tag = await db.crmTag.findUnique({ where: { id: tagId } });
      if (!tag) continue;
      const existing = await db.contactTag.findUnique({ where: { contactId_tagId: { contactId: contact.id, tagId } } });
      if (existing) continue;
      await db.contactTag.create({ data: { companyId, contactId: contact.id, tagId } });
      await logActivity(db, companyId, { contactId: contact.id, type: "TAG_ADDED", data: { tagId, name: tag.name } });
    }

    if (settings.pipelineId && settings.stageId) {
      await createOpportunity(db, companyId, {
        contactId: contact.id,
        pipelineId: settings.pipelineId,
        stageId: settings.stageId,
        ownerUserId: settings.ownerUserId ?? null,
        source: `form:${form.id}`,
      });
    }

    await logActivity(db, companyId, {
      contactId: contact.id,
      type: "FORM_SUBMITTED",
      data: { formId: form.id, formName: form.name, submissionId: submission.id },
    });

    await identifyVisitor(db, companyId, visitorId, contact.id);

    return { ok: true, message: settings.successMessage, redirectUrl: settings.redirectUrl };
  } catch (e) {
    console.error("[forms] invio fallito", { formId: form.id }, e);
    return { ok: false, status: 400, error: "Invio non riuscito, riprova" };
  }
}
