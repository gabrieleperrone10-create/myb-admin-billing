import type { FormField, FormSettings } from "@/lib/crm/types";

/**
 * Regole e costanti condivise fra editor (client), server action di salvataggio
 * e endpoint pubblico di invio. Nessun import "server-only" qui: deve poter
 * essere importato sia da componenti client (editor, form pubblico) sia da
 * codice server, senza duplicare le costanti.
 */

/**
 * Nome del campo honeypot nella pagina pubblica del form: un input tenuto
 * fuori schermo (non display:none, per non essere scartato dagli euristici
 * piu' grezzi) che un utente umano non puo' compilare ma un bot che riempie
 * ogni campo del form sì. Se arriva valorizzato, il submit finge un 200 senza
 * scrivere nulla.
 */
export const HONEYPOT_FIELD = "hp_azienda_web";

/** Dimensione massima accettata per il body di /api/public/forms/[id]/submit. */
export const MAX_SUBMIT_PAYLOAD_BYTES = 50_000;

/** Dimensione massima accettata per il body di /api/public/track. */
export const MAX_TRACK_PAYLOAD_BYTES = 8_000;

export const MAX_URL_LENGTH = 2000;
export const MAX_ATTRIBUTION_FIELD_LENGTH = 300;

/** Prefissi di FormField.mapTo. */
export function stdKeyOf(mapTo: string | null | undefined): string | null {
  return mapTo?.startsWith("std:") ? mapTo.slice(4) : null;
}
export function cfKeyOf(mapTo: string | null | undefined): string | null {
  return mapTo?.startsWith("cf:") ? mapTo.slice(3) : null;
}

/**
 * Valida la definizione di un form prima di salvarla. Ritorna il primo
 * errore trovato (messaggio in italiano, pronto per la UI) o null se valida.
 * Usata sia lato client (feedback immediato nell'editor) sia lato server
 * (unica fonte di verita', il client non e' fidato).
 */
export function validateFormDefinition(fields: FormField[], settings: FormSettings): string | null {
  if (!Array.isArray(fields) || fields.length === 0) {
    return "Aggiungi almeno un campo al form";
  }

  const ids = new Set<string>();
  for (const f of fields) {
    if (!f.id || ids.has(f.id)) return "Campo con id mancante o duplicato";
    ids.add(f.id);
    if (!f.label || !f.label.trim()) return "Ogni campo deve avere un'etichetta";
    if (f.label.length > 120) return `L'etichetta "${f.label.slice(0, 30)}…" è troppo lunga`;
    if ((f.type === "SELECT" || f.type === "MULTISELECT")) {
      const opts = (f.options ?? []).map(o => o.trim()).filter(Boolean);
      if (opts.length === 0) return `Il campo "${f.label}" richiede almeno un'opzione`;
    }
  }

  const identifying = fields.some(f => {
    const k = stdKeyOf(f.mapTo);
    return k === "email" || k === "phone" || k === "whatsapp";
  });
  if (!identifying) {
    return "Almeno un campo deve essere collegato a Email o Telefono: serve per identificare chi compila";
  }

  if (settings.redirectUrl) {
    if (!isHttpUrl(settings.redirectUrl)) {
      return "Il link di reindirizzamento deve iniziare con http:// o https://";
    }
  }

  if (settings.stageId && !settings.pipelineId) {
    return "Seleziona anche la pipeline per la fase scelta";
  }

  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Etichetta breve del tipo di mappatura, per la UI dell'editor. */
export function mapToSummary(mapTo: string | null | undefined): "std" | "cf" | "none" {
  if (stdKeyOf(mapTo)) return "std";
  if (cfKeyOf(mapTo)) return "cf";
  return "none";
}
