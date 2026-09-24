/**
 * Normalizzazione di fonti e campagne per l'attribuzione. Modulo PURO.
 *
 * Modello di attribuzione: FIRST-TOUCH. Si usa Contact.attribution, che viene
 * scritto una sola volta alla prima identificazione del contatto (form, booking)
 * e non si sovrascrive. In ordine:
 *   1. utm_source (normalizzato con SOURCE_ALIASES);
 *   2. gclid presente -> "google"; fbclid presente -> "meta" (click da ads senza UTM);
 *   3. Contact.source (form:<id> -> "form", booking, whatsapp, import, manual, billing, email);
 *   4. "unknown".
 * La campagna e' utm_campaign (trim, confronto case-insensitive); senza campagna
 * il contatto finisce nella riga "(nessuna campagna)" della sua fonte.
 */

/**
 * Mappa configurabile: valore grezzo (minuscolo) -> fonte canonica.
 * Aggiungere qui gli alias che arrivano dalle UTM o dagli import di spesa.
 */
export const SOURCE_ALIASES: Record<string, string> = {
  // Meta
  meta: "meta",
  fb: "meta",
  facebook: "meta",
  "facebook.com": "meta",
  "m.facebook.com": "meta",
  "l.facebook.com": "meta",
  "lm.facebook.com": "meta",
  "facebook_ads": "meta",
  "facebook-ads": "meta",
  "meta_ads": "meta",
  "meta-ads": "meta",
  ig: "meta",
  insta: "meta",
  instagram: "meta",
  "instagram.com": "meta",
  "l.instagram.com": "meta",
  an: "meta", // Audience Network
  messenger: "meta",
  // Google
  google: "google",
  "google.com": "google",
  "google-ads": "google",
  "google_ads": "google",
  googleads: "google",
  adwords: "google",
  gads: "google",
  // Altri canali frequenti
  tiktok: "tiktok",
  tt: "tiktok",
  "tiktok.com": "tiktok",
  youtube: "youtube",
  yt: "youtube",
  "youtube.com": "youtube",
  linkedin: "linkedin",
  li: "linkedin",
  "linkedin.com": "linkedin",
  newsletter: "email",
  mail: "email",
  email: "email",
  bing: "bing",
};

/** Etichette leggibili delle fonti canoniche (le altre si mostrano come arrivano). */
export const SOURCE_LABELS: Record<string, string> = {
  meta: "Meta (Facebook/Instagram)",
  google: "Google",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  bing: "Bing",
  email: "Email",
  form: "Form (senza UTM)",
  booking: "Prenotazione (senza UTM)",
  whatsapp: "WhatsApp",
  import: "Import",
  manual: "Inserimento manuale",
  billing: "Da fatturazione",
  unknown: "Sconosciuta",
};

export const NO_CAMPAIGN_KEY = "";
export const NO_CAMPAIGN_LABEL = "(nessuna campagna)";

export function sourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key;
}

/** Fonte canonica da un valore grezzo (UTM, CSV di spesa, form). null se vuoto. */
export function normalizeSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!s) return null;
  return SOURCE_ALIASES[s] ?? s;
}

/** Chiave di confronto per la campagna (utm_campaign vs AdSpend.campaign). */
export function campaignKey(raw: unknown): string {
  if (typeof raw !== "string") return NO_CAMPAIGN_KEY;
  return raw.trim().toLowerCase();
}

type AttributionJson = Record<string, unknown> | null | undefined;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Fonte di ripiego dal campo Contact.source. */
export function fallbackSource(contactSource: string | null | undefined): string {
  const s = (contactSource ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.startsWith("form:") || s === "form") return "form";
  return SOURCE_ALIASES[s] ?? s;
}

export type ContactChannel = {
  source: string;
  /** Chiave normalizzata ("" = nessuna campagna) */
  campaign: string;
  /** Nome campagna come arrivato (per la visualizzazione) */
  campaignLabel: string | null;
};

export function contactChannel(contact: { source?: string | null; attribution?: unknown }): ContactChannel {
  const a = (contact.attribution && typeof contact.attribution === "object" && !Array.isArray(contact.attribution)
    ? contact.attribution
    : null) as AttributionJson;

  const campaignRaw = str(a?.utm_campaign);
  const campaign = campaignKey(campaignRaw);
  const campaignLabel = campaignRaw;

  const utm = normalizeSource(a?.utm_source);
  if (utm) return { source: utm, campaign, campaignLabel };
  if (str(a?.gclid)) return { source: "google", campaign, campaignLabel };
  if (str(a?.fbclid)) return { source: "meta", campaign, campaignLabel };
  return { source: fallbackSource(contact.source), campaign, campaignLabel };
}
