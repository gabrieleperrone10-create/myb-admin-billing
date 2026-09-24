import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica delle firme dei webhook + parsing degli indirizzi.
 *
 * Modulo PURO di proposito (niente "server-only", niente Prisma, niente env):
 * lo importa scripts/test-webhook-signatures.mts con `npx tsx`, cosi' la parte
 * piu' delicata dei webhook e' verificabile senza database ne' server.
 *
 * Tutti i confronti di firma sono timing-safe: un confronto `===` su stringhe
 * termina al primo carattere diverso e, misurando i tempi, permette di
 * ricostruire una firma valida un byte alla volta.
 */

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Svix (Resend) ─────────────────────────────────────────────────────────

export const SVIX_TOLERANCE_SEC = 5 * 60;

/**
 * Standard Svix (usato da Resend):
 *   contenuto firmato = `${svix-id}.${svix-timestamp}.${raw body}`
 *   firma = base64(HMAC-SHA256(chiave, contenuto)), chiave = base64decode(secret senza "whsec_")
 *   header svix-signature = elenco separato da spazi di "v1,<firma>" (piu' firme durante la rotazione del secret)
 *
 * Il timestamp e' parte del contenuto firmato e va controllato contro l'ora
 * attuale: senza tolleranza, una richiesta intercettata resterebbe
 * riproducibile per sempre (replay).
 *
 * L'SDK resend v6 espone `resend.webhooks.verify()` (che usa il pacchetto svix),
 * ma qui si implementa lo standard a mano per poterlo testare in isolamento e
 * non dipendere da una dipendenza transitiva.
 */
export function verifySvixSignature(params: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  /** secondi epoch; iniettabile nei test */
  nowSec?: number;
  toleranceSec?: number;
}): boolean {
  const { payload, id, timestamp, signature, secret } = params;
  if (!id || !timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return false;
  const now = params.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > (params.toleranceSec ?? SVIX_TOLERANCE_SEC)) return false;

  const rawKey = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(rawKey, "base64");
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest();

  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || !sig) continue;
    let given: Buffer;
    try { given = Buffer.from(sig, "base64"); } catch { continue; }
    if (safeEqual(given, expected)) return true;
  }
  return false;
}

/** Costruisce l'header svix-signature (per i test). */
export function signSvix(payload: string, id: string, timestamp: string, secret: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")}`;
}

// ─── Meta (WhatsApp Cloud API) ─────────────────────────────────────────────

/**
 * X-Hub-Signature-256: "sha256=<hex HMAC-SHA256(appSecret, raw body)>".
 * Il body va usato ESATTAMENTE come arrivato: ri-serializzare il JSON cambia
 * spazi/escape unicode e invalida la firma.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const hex = header.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return safeEqual(Buffer.from(hex, "hex"), expected);
}

/** Costruisce l'header X-Hub-Signature-256 (per i test). */
export function signMeta(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

// ─── Indirizzi email ───────────────────────────────────────────────────────

/** "Mario Rossi <mario@x.it>" -> "mario@x.it" (minuscolo). null se non e' un indirizzo. */
export function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^<>\s]+@[^<>\s]+)>/) ?? raw.match(/([^\s<>"',;]+@[^\s<>"',;]+)/);
  const s = m?.[1]?.trim().toLowerCase();
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** Indirizzo Reply-To di un contatto: c-<replyToken>@<dominio inbound>. */
export function replyAddressFor(replyToken: string, inboundDomain: string): string {
  return `c-${replyToken}@${inboundDomain}`;
}

/**
 * Estrae il replyToken da un destinatario "c-<token>@<dominio>". Se `domain`
 * e' dato, il dominio deve coincidere (senza, un indirizzo c-...@altrodominio
 * in copia verrebbe preso per buono). Il token e' un cuid: solo [a-z0-9].
 */
export function parseReplyToken(address: string | null | undefined, domain?: string | null): string | null {
  const email = extractEmailAddress(address);
  if (!email) return null;
  const [local, host] = email.split("@");
  if (domain && host !== domain.toLowerCase()) return null;
  const m = local.match(/^c-([a-z0-9]{8,64})$/);
  return m ? m[1] : null;
}

// ─── Testo / HTML ──────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Testo semplice -> HTML minimale (paragrafi e a capo), con escape. */
export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px;line-height:1.55;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:sans-serif;color:#111827;font-size:14px;">${paragraphs}</body></html>`;
}

/** HTML -> testo leggibile (anteprime, fallback text/plain). Non e' un sanitizer. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Taglia la parte citata di una risposta email ("Il giorno ... ha scritto:",
 * "On ... wrote:", righe che iniziano con ">"). Euristica: se il risultato e'
 * vuoto si tiene il testo intero.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*(Il giorno|On)\b.*(ha scritto|wrote):?\s*$/i.test(line)) break;
    if (/^\s*-{2,}\s*(Original Message|Messaggio originale)\s*-{2,}/i.test(line)) break;
    out.push(line);
  }
  const s = out.join("\n").trim();
  return s || text.trim();
}
