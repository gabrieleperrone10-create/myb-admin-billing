import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalizza un numero in E.164 (+393331234567). Senza prefisso assume
 * l'Italia. Restituisce null se il numero non e' valido: meglio nessun telefono
 * che uno sbagliato, perche' il telefono e' chiave di deduplica e destinatario
 * WhatsApp.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry: CountryCode = "IT"): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^00/, "+");
  if (!s) return null;
  const p = parsePhoneNumberFromString(s, defaultCountry);
  return p && p.isValid() ? p.number : null;
}

/** Numero WhatsApp come lo vuole la Cloud API: cifre senza "+". */
export function toWhatsAppId(e164: string): string {
  return e164.replace(/^\+/, "");
}
