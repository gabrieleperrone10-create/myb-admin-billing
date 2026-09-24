/**
 * Formattazione dei numeri dei report (italiano). Modulo PURO: usabile da
 * Server e Client Component. I Client Component lo importano direttamente,
 * mai ricevendo formatter come prop.
 */
import { formatCurrency } from "@/lib/utils";

export const DASH = "—";

export function fmtEur(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : formatCurrency(n);
}

const intFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const oneDec = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDec = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtInt(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : intFmt.format(n);
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${oneDec.format(n)}%`;
}

/** ROAS come moltiplicatore: 3,20× */
export function fmtRoas(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? DASH : `${twoDec.format(n)}×`;
}

export function fmtDays(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  if (n < 1) {
    const h = Math.round(n * 24);
    return h <= 1 ? "< 1 h" : `${h} h`;
  }
  return `${oneDec.format(n)} gg`;
}

/** Asse euro compatto: 0, 950 €, 1,2k €, 3,4M € */
export function fmtEurAxis(v: number): string {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1_000_000) return `${oneDec.format(v / 1_000_000)}M €`;
  if (Math.abs(v) >= 1_000) return `${oneDec.format(v / 1_000)}k €`;
  return `${intFmt.format(v)} €`;
}
