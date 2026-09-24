import { z } from "zod";
import type { CustomFieldDef, CustomFieldType } from "@prisma/client";
import { normalizePhone } from "./phone";

/**
 * Validazione dei valori dei campi personalizzati. Unica fonte per UI, import
 * CSV, form pubblici e API: tutti passano da qui prima di scrivere in
 * Contact.customFields / Opportunity.customFields.
 */

export type CustomFieldValue = string | number | boolean | string[] | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  TEXT: "Testo",
  TEXTAREA: "Testo lungo",
  NUMBER: "Numero",
  DATE: "Data",
  SELECT: "Scelta singola",
  MULTISELECT: "Scelta multipla",
  CHECKBOX: "Sì/No",
  URL: "Link",
  EMAIL: "Email",
  PHONE: "Telefono",
};

/** Slug stabile per CustomFieldDef.key a partire dall'etichetta. */
export function fieldKeyFromLabel(label: string): string {
  return label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 48) || "campo";
}

function optionsOf(def: Pick<CustomFieldDef, "options">): string[] {
  return Array.isArray(def.options) ? (def.options as unknown[]).map(String) : [];
}

/**
 * Converte un valore grezzo (stringa da form/CSV o valore gia' tipizzato) nel
 * valore da salvare. Restituisce `{ ok: false }` con messaggio italiano se non
 * valido. Stringa vuota / null => null (campo svuotato).
 */
export function coerceFieldValue(
  def: Pick<CustomFieldDef, "type" | "options" | "required" | "label">,
  raw: unknown,
): { ok: true; value: CustomFieldValue } | { ok: false; error: string } {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")
    || (Array.isArray(raw) && raw.length === 0);
  if (empty) {
    return def.required ? { ok: false, error: `${def.label} è obbligatorio` } : { ok: true, value: null };
  }
  const s = typeof raw === "string" ? raw.trim() : raw;

  switch (def.type) {
    case "TEXT":
    case "TEXTAREA":
      return { ok: true, value: String(s).slice(0, def.type === "TEXT" ? 500 : 10_000) };
    case "NUMBER": {
      const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${def.label}: numero non valido` };
    }
    case "DATE": {
      const d = new Date(String(s));
      return Number.isNaN(d.getTime())
        ? { ok: false, error: `${def.label}: data non valida` }
        : { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case "CHECKBOX": {
      if (typeof s === "boolean") return { ok: true, value: s };
      const v = String(s).toLowerCase();
      if (["true", "1", "si", "sì", "yes", "on", "x"].includes(v)) return { ok: true, value: true };
      if (["false", "0", "no", "off"].includes(v)) return { ok: true, value: false };
      return { ok: false, error: `${def.label}: valore sì/no non valido` };
    }
    case "SELECT": {
      const opts = optionsOf(def);
      const v = String(s);
      const match = opts.find(o => o.toLowerCase() === v.toLowerCase());
      return match ? { ok: true, value: match } : { ok: false, error: `${def.label}: opzione "${v}" non prevista` };
    }
    case "MULTISELECT": {
      const opts = optionsOf(def);
      const list = Array.isArray(s) ? s.map(String) : String(s).split(/[,;|]/).map(x => x.trim()).filter(Boolean);
      const out: string[] = [];
      for (const v of list) {
        const match = opts.find(o => o.toLowerCase() === v.toLowerCase());
        if (!match) return { ok: false, error: `${def.label}: opzione "${v}" non prevista` };
        if (!out.includes(match)) out.push(match);
      }
      return { ok: true, value: out };
    }
    case "URL": {
      const r = z.string().url().safeParse(/^https?:\/\//i.test(String(s)) ? String(s) : `https://${s}`);
      return r.success ? { ok: true, value: r.data } : { ok: false, error: `${def.label}: link non valido` };
    }
    case "EMAIL": {
      const r = z.string().email().safeParse(String(s).toLowerCase());
      return r.success ? { ok: true, value: r.data } : { ok: false, error: `${def.label}: email non valida` };
    }
    case "PHONE": {
      const p = normalizePhone(String(s));
      return p ? { ok: true, value: p } : { ok: false, error: `${def.label}: telefono non valido` };
    }
  }
}

/**
 * Valida un insieme di valori contro le definizioni dell'azienda. Le chiavi
 * sconosciute vengono scartate (mai scritte). Con `partial` i campi assenti
 * non vengono controllati per l'obbligatorieta' (update di un solo campo).
 */
export function validateCustomFields(
  defs: Pick<CustomFieldDef, "key" | "type" | "options" | "required" | "label">[],
  input: Record<string, unknown>,
  opts: { partial?: boolean } = {},
): { ok: true; values: CustomFieldValues } | { ok: false; errors: Record<string, string> } {
  const values: CustomFieldValues = {};
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (opts.partial && !(def.key in input)) continue;
    const r = coerceFieldValue(def, input[def.key]);
    if (r.ok) values[def.key] = r.value;
    else errors[def.key] = r.error;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

/** Rappresentazione testuale per tabelle/timeline. */
export function formatFieldValue(type: CustomFieldType, v: CustomFieldValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (type === "CHECKBOX") return v ? "Sì" : "No";
  if (type === "DATE" && typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("it-IT");
  }
  return String(v);
}
