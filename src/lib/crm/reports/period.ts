/**
 * Periodi dei report. Modulo PURO (niente DB, niente "server-only"): usato dalla
 * pagina, dalle query e da scripts/test-reports.mts.
 *
 * Convenzioni:
 *  - il periodo si ragiona in DATE DI CALENDARIO nel fuso dell'azienda
 *    ("yyyy-MM-dd", estremi inclusi): e' cio' che l'utente sceglie e cio' con cui
 *    si ripartisce la spesa pubblicitaria (che e' anch'essa a giorni);
 *  - per le query si converte in istanti UTC: `from` = mezzanotte locale del primo
 *    giorno, `to` = mezzanotte locale del giorno DOPO l'ultimo (ESCLUSIVO);
 *  - il periodo di confronto e' la finestra di pari durata immediatamente
 *    precedente (30 giorni -> i 30 giorni prima; "mese corrente" al giorno 10 ->
 *    i 10 giorni prima del primo del mese).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PERIOD_PRESETS = ["7d", "30d", "90d", "month", "lastmonth", "year", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  "7d": "7 giorni",
  "30d": "30 giorni",
  "90d": "90 giorni",
  month: "Mese corrente",
  lastmonth: "Mese scorso",
  year: "Anno",
  custom: "Personalizzato",
};

export const DEFAULT_PRESET: PeriodPreset = "30d";
/** Oltre questo intervallo un periodo personalizzato viene troncato (protezione query). */
export const MAX_CUSTOM_DAYS = 3 * 366;

export type Granularity = "day" | "week" | "month";

export type DateRange = {
  /** Primo giorno incluso, "yyyy-MM-dd" nel fuso aziendale */
  fromDay: string;
  /** Ultimo giorno incluso, "yyyy-MM-dd" nel fuso aziendale */
  toDay: string;
  /** Istante UTC di inizio (incluso) */
  from: Date;
  /** Istante UTC di fine (ESCLUSO) */
  to: Date;
  days: number;
};

export type ResolvedPeriod = DateRange & {
  preset: PeriodPreset;
  previous: DateRange;
  granularity: Granularity;
  timezone: string;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "yyyy-MM-dd" valido (anche come data reale: niente 2026-02-31). */
export function isDayString(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Giorni fra due date di calendario, estremi inclusi (a > b -> 0). */
export function daysInclusive(fromDay: string, toDay: string): number {
  const a = Date.parse(`${fromDay}T00:00:00Z`);
  const b = Date.parse(`${toDay}T00:00:00Z`);
  if (b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function todayIn(tz: string, now = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** Data di calendario (nel fuso) di un istante. */
export function dayOf(instant: Date, tz: string): string {
  return formatInTimeZone(instant, tz, "yyyy-MM-dd");
}

export function makeRange(fromDay: string, toDay: string, tz: string): DateRange {
  return {
    fromDay,
    toDay,
    from: fromZonedTime(`${fromDay}T00:00:00`, tz),
    to: fromZonedTime(`${addDays(toDay, 1)}T00:00:00`, tz),
    days: daysInclusive(fromDay, toDay),
  };
}

export function granularityFor(days: number): Granularity {
  if (days <= 62) return "day";
  if (days <= 366) return "week";
  return "month";
}

export function parsePreset(v: unknown): PeriodPreset {
  return typeof v === "string" && (PERIOD_PRESETS as readonly string[]).includes(v)
    ? (v as PeriodPreset)
    : DEFAULT_PRESET;
}

export function resolvePeriod(
  presetRaw: unknown,
  fromRaw: unknown,
  toRaw: unknown,
  tz: string,
  now = new Date(),
): ResolvedPeriod {
  let preset = parsePreset(presetRaw);
  const today = todayIn(tz, now);
  let fromDay: string;
  let toDay = today;

  switch (preset) {
    case "7d": fromDay = addDays(today, -6); break;
    case "30d": fromDay = addDays(today, -29); break;
    case "90d": fromDay = addDays(today, -89); break;
    case "month": fromDay = `${today.slice(0, 7)}-01`; break;
    case "lastmonth": {
      const firstThis = `${today.slice(0, 7)}-01`;
      toDay = addDays(firstThis, -1);
      fromDay = `${toDay.slice(0, 7)}-01`;
      break;
    }
    case "year": fromDay = `${today.slice(0, 4)}-01-01`; break;
    case "custom": {
      if (!isDayString(fromRaw) && !isDayString(toRaw)) {
        preset = DEFAULT_PRESET;
        fromDay = addDays(today, -29);
        break;
      }
      toDay = isDayString(toRaw) ? toRaw : today;
      fromDay = isDayString(fromRaw) ? fromRaw : addDays(toDay, -29);
      if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
      if (daysInclusive(fromDay, toDay) > MAX_CUSTOM_DAYS) fromDay = addDays(toDay, -(MAX_CUSTOM_DAYS - 1));
      break;
    }
  }

  const current = makeRange(fromDay, toDay, tz);
  const prevTo = addDays(fromDay, -1);
  const prevFrom = addDays(prevTo, -(current.days - 1));
  return {
    ...current,
    preset,
    previous: makeRange(prevFrom, prevTo, tz),
    granularity: granularityFor(current.days),
    timezone: tz,
  };
}

// ─── Bucket per i grafici di andamento ─────────────────────────────────────

/** Chiave del bucket che contiene il giorno `day` ("yyyy-MM-dd"). */
export function bucketKey(day: string, g: Granularity): string {
  if (g === "day") return day;
  if (g === "month") return `${day.slice(0, 7)}-01`;
  // settimana ISO: lunedi'
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = domenica
  return addDays(day, -((dow + 6) % 7));
}

const fmtDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtMonth = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" });

export function bucketLabel(key: string, g: Granularity): string {
  const d = new Date(`${key}T00:00:00Z`);
  if (g === "month") return fmtMonth.format(d);
  if (g === "week") return `sett. ${fmtDay.format(d)}`;
  return fmtDay.format(d);
}

/** Tutti i bucket del periodo, in ordine, anche quelli vuoti. */
export function listBuckets(range: Pick<DateRange, "fromDay" | "toDay">, g: Granularity): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  for (let d = range.fromDay; d <= range.toDay; d = addDays(d, 1)) {
    const k = bucketKey(d, g);
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ key: k, label: bucketLabel(k, g) });
    }
  }
  return out;
}

const fmtLong = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDay(day: string): string {
  return fmtLong.format(new Date(`${day}T00:00:00Z`));
}

export function describeRange(r: Pick<DateRange, "fromDay" | "toDay">): string {
  return r.fromDay === r.toDay ? formatDay(r.fromDay) : `${formatDay(r.fromDay)} – ${formatDay(r.toDay)}`;
}
