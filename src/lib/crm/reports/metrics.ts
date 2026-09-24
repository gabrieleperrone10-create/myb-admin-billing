/**
 * Rapporti dei report. Modulo PURO. Ogni divisione per zero restituisce null
 * (in UI "—"), mai Infinity/NaN: un ROAS "infinito" con spesa zero non e'
 * un'informazione, e' un errore di lettura.
 */

export function safeDiv(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

/** ROAS = incassato / spesa (es. 3.2 = 3,20 € incassati per ogni € speso). */
export function roas(collected: number, spend: number): number | null {
  return safeDiv(collected, spend);
}

/** CPL = spesa / lead. */
export function cpl(spend: number, leads: number): number | null {
  if (spend <= 0) return null;
  return safeDiv(spend, leads);
}

/** CAC = spesa / clienti acquisiti. */
export function cac(spend: number, customers: number): number | null {
  if (spend <= 0) return null;
  return safeDiv(spend, customers);
}

/** Percentuale 0-100, null se il denominatore e' 0. */
export function rate(part: number, whole: number): number | null {
  const r = safeDiv(part, whole);
  return r === null ? null : r * 100;
}

/**
 * Variazione % rispetto al periodo precedente.
 * prev = 0 e cur = 0 -> 0; prev = 0 e cur != 0 -> null (non definita).
 */
export function deltaPct(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
