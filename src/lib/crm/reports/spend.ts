/**
 * Spesa pubblicitaria: ripartizione pro-rata e import CSV. Modulo PURO.
 *
 * Convenzione di salvataggio (AdSpend.periodStart / periodEnd): DATE DI
 * CALENDARIO salvate a mezzanotte UTC, estremi INCLUSI. Una spesa "1-30
 * settembre" e' periodStart = 2026-09-01T00:00Z, periodEnd = 2026-09-30T00:00Z.
 * Cosi' la data resta la stessa indipendentemente dal fuso di chi guarda.
 *
 * Pro-rata: se il periodo di una spesa si sovrappone solo in parte al filtro, si
 * conta la quota proporzionale ai GIORNI sovrapposti:
 *   quota = importo × giorni_sovrapposti / giorni_totali_della_spesa
 * (distribuzione uniforme della spesa sui giorni del suo periodo).
 */
import { parse } from "csv-parse/sync";
import { daysInclusive, isDayString } from "./period";
import { campaignKey, normalizeSource, NO_CAMPAIGN_KEY } from "./sources";

export type SpendEntry = {
  source: string;
  campaign: string | null;
  /** Data di calendario (mezzanotte UTC) */
  periodStart: Date;
  /** Data di calendario (mezzanotte UTC), inclusa */
  periodEnd: Date;
  amount: number;
};

/** "yyyy-MM-dd" di una data salvata con la convenzione sopra. */
export function storedDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date di calendario -> valori da salvare. */
export function dayToStored(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Quota della spesa che cade nel periodo [fromDay, toDay] (estremi inclusi). */
export function prorateSpend(entry: Pick<SpendEntry, "periodStart" | "periodEnd" | "amount">, fromDay: string, toDay: string): number {
  let s = storedDay(entry.periodStart);
  let e = storedDay(entry.periodEnd);
  if (e < s) [s, e] = [e, s];
  const total = daysInclusive(s, e);
  if (total <= 0 || !(entry.amount > 0)) return 0;
  const os = s > fromDay ? s : fromDay;
  const oe = e < toDay ? e : toDay;
  const overlap = daysInclusive(os, oe);
  if (overlap <= 0) return 0;
  return (entry.amount * overlap) / total;
}

export type SpendAggregate = {
  total: number;
  /** fonte -> { totale, campagna (chiave normalizzata, "" = non assegnata) -> importo } */
  bySource: Map<string, { total: number; byCampaign: Map<string, number>; campaignLabels: Map<string, string> }>;
};

export function aggregateSpend(entries: SpendEntry[], fromDay: string, toDay: string): SpendAggregate {
  const agg: SpendAggregate = { total: 0, bySource: new Map() };
  for (const e of entries) {
    const amt = prorateSpend(e, fromDay, toDay);
    if (amt <= 0) continue;
    const src = normalizeSource(e.source) ?? "unknown";
    const ck = e.campaign ? campaignKey(e.campaign) : NO_CAMPAIGN_KEY;
    let s = agg.bySource.get(src);
    if (!s) {
      s = { total: 0, byCampaign: new Map(), campaignLabels: new Map() };
      agg.bySource.set(src, s);
    }
    s.total += amt;
    s.byCampaign.set(ck, (s.byCampaign.get(ck) ?? 0) + amt);
    if (ck && e.campaign && !s.campaignLabels.has(ck)) s.campaignLabels.set(ck, e.campaign.trim());
    agg.total += amt;
  }
  return agg;
}

// ─── Parsing di importi e date (formati italiani) ──────────────────────────

/**
 * Importo da stringa: accetta "1234.56", "1234,56", "1.234,56", "1,234.56",
 * "€ 1.234", "1 234,5". Con un solo separatore: la virgola e' sempre decimale;
 * il punto e' separatore delle migliaia solo se seguito da gruppi di 3 cifre
 * ("1.500" = 1500, convenzione italiana), altrimenti decimale ("12.5").
 * null se non valido o negativo.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[€\s ]/g, "").replace(/eur$/i, "");
  if (!s || s.startsWith("-")) return null;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (hasComma) {
    const parts = s.split(",");
    s = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split(".").join("");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Data di calendario da "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy" (anche giorno/mese a 1 cifra). */
export function parseDay(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (isDayString(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const day = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isDayString(day) ? day : null;
}

// ─── Import CSV ────────────────────────────────────────────────────────────

export type ParsedSpendRow = {
  line: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  campaign: string | null;
  amount: number;
};

export type SpendCsvResult = {
  rows: ParsedSpendRow[];
  errors: { line: number; message: string }[];
};

export const CSV_MAX_ROWS = 2000;

const HEADER_ALIASES: Record<"start" | "end" | "source" | "campaign" | "amount", string[]> = {
  start: ["data inizio", "data_inizio", "inizio", "dal", "start", "start date", "periodstart", "period_start", "data"],
  end: ["data fine", "data_fine", "fine", "al", "end", "end date", "periodend", "period_end"],
  source: ["fonte", "source", "canale", "utm_source", "piattaforma"],
  campaign: ["campagna", "campaign", "utm_campaign", "nome campagna", "campaign name"],
  amount: ["importo", "amount", "spesa", "costo", "cost", "spend", "importo speso", "importo speso (eur)", "amount spent (eur)"],
};

function detectDelimiter(text: string): "," | ";" {
  const first = text.split(/\r?\n/).find(l => l.trim()) ?? "";
  const semi = (first.match(/;/g) ?? []).length;
  const comma = (first.match(/,/g) ?? []).length;
  return semi >= comma && semi > 0 ? ";" : ",";
}

/**
 * CSV con colonne: data inizio, data fine, fonte, campagna, importo.
 * Separatore "," o ";" (rilevato dalla prima riga). Intestazione facoltativa:
 * se presente, le colonne si riconoscono per nome (anche in ordine diverso);
 * altrimenti si usa l'ordine sopra. La fonte si salva normalizzata.
 */
export function parseSpendCsv(text: string): SpendCsvResult {
  const result: SpendCsvResult = { rows: [], errors: [] };
  const clean = text.replace(/^﻿/, "");
  if (!clean.trim()) {
    result.errors.push({ line: 0, message: "Il file è vuoto" });
    return result;
  }

  let records: string[][];
  try {
    records = parse(clean, {
      delimiter: detectDelimiter(clean),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    });
  } catch (e) {
    result.errors.push({ line: 0, message: `CSV non leggibile: ${e instanceof Error ? e.message : String(e)}` });
    return result;
  }
  if (records.length === 0) {
    result.errors.push({ line: 0, message: "Il file è vuoto" });
    return result;
  }

  let idx = { start: 0, end: 1, source: 2, campaign: 3, amount: 4 };
  let startAt = 0;
  const header = records[0].map(h => h.trim().toLowerCase());
  if (!parseDay(records[0][0] ?? "")) {
    const find = (k: keyof typeof HEADER_ALIASES) => header.findIndex(h => HEADER_ALIASES[k].includes(h));
    const found = { start: find("start"), end: find("end"), source: find("source"), campaign: find("campaign"), amount: find("amount") };
    if (found.start < 0 || found.source < 0 || found.amount < 0) {
      result.errors.push({ line: 1, message: "Intestazione non riconosciuta: servono almeno le colonne data inizio, fonte, importo" });
      return result;
    }
    idx = {
      start: found.start,
      end: found.end >= 0 ? found.end : found.start,
      source: found.source,
      campaign: found.campaign,
      amount: found.amount,
    };
    startAt = 1;
  }

  const body = records.slice(startAt);
  if (body.length > CSV_MAX_ROWS) {
    result.errors.push({ line: 0, message: `Troppe righe (${body.length}): massimo ${CSV_MAX_ROWS} per import` });
    return result;
  }

  body.forEach((r, i) => {
    const line = i + startAt + 1;
    const start = parseDay(r[idx.start] ?? "");
    const end = parseDay(r[idx.end] ?? "");
    const source = normalizeSource(r[idx.source] ?? "");
    const campaignRaw = idx.campaign >= 0 ? (r[idx.campaign] ?? "").trim() : "";
    const amount = parseAmount(r[idx.amount] ?? "");
    const problems: string[] = [];
    if (!start) problems.push("data inizio non valida");
    if (!end) problems.push("data fine non valida");
    if (!source) problems.push("fonte mancante");
    if (amount === null) problems.push("importo non valido");
    if (start && end && end < start) problems.push("data fine precedente alla data inizio");
    if (problems.length) {
      result.errors.push({ line, message: problems.join(", ") });
      return;
    }
    result.rows.push({
      line,
      periodStart: start!,
      periodEnd: end!,
      source: source!,
      campaign: campaignRaw ? campaignRaw.slice(0, 200) : null,
      amount: amount!,
    });
  });
  return result;
}
