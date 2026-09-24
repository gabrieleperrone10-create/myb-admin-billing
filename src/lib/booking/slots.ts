import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * Calcolo degli slot prenotabili — modulo PURO (niente DB, niente
 * "server-only"): lo usano le API pubbliche, le action interne, e il test
 * `scripts/test-booking-slots.mts`.
 *
 * Portato da Nutrizionisti-app `src/lib/services/bookingSlots.ts`, con due
 * differenze volute:
 *  - il fuso non e' fisso (Europe/Rome) ma e' quello del calendario;
 *  - si calcola su una finestra di piu' giorni in una passata sola (la pagina
 *    pubblica mostra un mese: una query e una freebusy, non trenta).
 *
 * Regole:
 *  - la disponibilita' ("HH:mm" per giorno della settimana) e' nel fuso del
 *    calendario; il giorno della settimana si ricava dalla data "pura"
 *    (YYYY-MM-DD), mai da un istante convertito;
 *  - gli slot si generano sulla linea del tempo reale (UTC) a partire
 *    dall'inizio della fascia: nel giorno del cambio d'ora una fascia
 *    01:00-04:00 dura 2 o 4 ore vere, e non si producono orari inesistenti
 *    o doppi;
 *  - uno slot [s, s+durata) e' libero se non si sovrappone a nessun
 *    intervallo occupato allargato del buffer ([b.start-buffer, b.end+buffer));
 *  - s >= ora + anticipo minimo; s <= ora + anticipo massimo (giorni).
 */

export type WeeklyRange = { dayOfWeek: number; startTime: string; endTime: string };
export type BusyInterval = { start: Date; end: Date };

export type SlotRules = {
  timezone: string;
  availability: WeeklyRange[];
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
};

const MIN = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidDateStr(s: string | null | undefined): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(s: string): boolean {
  return TIME_RE.test(s);
}

/** Giorno della settimana (0=dom) di una data "pura". */
export function dayOfWeekOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Somma giorni a una data "pura" (aritmetica di calendario, niente fusi). */
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Istante UTC di "questa data, quest'ora" nel fuso indicato. */
export function zonedDateTime(dateStr: string, time: string, tz: string): Date {
  if (time === "24:00") return fromZonedTime(`${addDaysStr(dateStr, 1)}T00:00:00`, tz);
  return fromZonedTime(`${dateStr}T${time}:00`, tz);
}

/** Data locale (YYYY-MM-DD) di un istante in un fuso. */
export function dateInTz(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

/** Ora locale (HH:mm) di un istante in un fuso. */
export function timeInTz(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "HH:mm");
}

/** [inizio giorno `from`, inizio giorno dopo `to`) nel fuso, come istanti UTC. */
export function zonedRange(from: string, to: string, tz: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${from}T00:00:00`, tz),
    end: fromZonedTime(`${addDaysStr(to, 1)}T00:00:00`, tz),
  };
}

function overlaps(s: number, e: number, busy: { s: number; e: number }[]): boolean {
  for (const b of busy) if (s < b.e && e > b.s) return true;
  return false;
}

/**
 * Slot liberi (istanti di inizio, ordinati) che cadono in [windowStart, windowEnd).
 * `busy` = appuntamenti attivi dell'host (su qualunque calendario) + impegni Google.
 */
export function computeSlots(
  rules: SlotRules,
  busy: BusyInterval[],
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date(),
): Date[] {
  const tz = rules.timezone;
  const dur = Math.max(5, rules.durationMinutes) * MIN;
  const step = Math.max(5, rules.slotIntervalMinutes) * MIN;
  const buffer = Math.max(0, rules.bufferMinutes) * MIN;

  const earliest = Math.max(windowStart.getTime(), now.getTime() + rules.minAdvanceHours * 60 * MIN);
  const latest = Math.min(windowEnd.getTime(), now.getTime() + rules.maxAdvanceDays * 24 * 60 * MIN);
  if (earliest >= latest) return [];

  const busyMs = busy
    .map(b => ({ s: b.start.getTime() - buffer, e: b.end.getTime() + buffer }))
    .filter(b => b.e > b.s);

  const byDay = new Map<number, WeeklyRange[]>();
  for (const r of rules.availability) {
    if (!isValidTime(r.startTime) || !isValidTime(r.endTime) || r.startTime >= r.endTime) continue;
    const list = byDay.get(r.dayOfWeek) ?? [];
    list.push(r);
    byDay.set(r.dayOfWeek, list);
  }

  // Le date di calendario (nel fuso del calendario) che possono contenere
  // slot della finestra: un giorno di margine per lato copre qualunque fuso.
  const firstDate = addDaysStr(dateInTz(new Date(earliest), tz), -1);
  const lastDate = addDaysStr(dateInTz(new Date(latest), tz), 1);

  const out = new Set<number>();
  for (let date = firstDate; date <= lastDate; date = addDaysStr(date, 1)) {
    const ranges = byDay.get(dayOfWeekOf(date));
    if (!ranges) continue;
    for (const r of ranges) {
      const blockStart = zonedDateTime(date, r.startTime, tz).getTime();
      const blockEnd = zonedDateTime(date, r.endTime, tz).getTime();
      for (let s = blockStart; s + dur <= blockEnd; s += step) {
        if (s < earliest || s >= latest) continue;
        if (overlaps(s, s + dur, busyMs)) continue;
        out.add(s);
      }
    }
  }
  return [...out].sort((a, b) => a - b).map(ms => new Date(ms));
}

/** Raggruppa gli slot per giorno nel fuso di chi guarda: { "2026-10-01": ["2026-10-01T07:00:00.000Z", ...] }. */
export function groupSlotsByDay(slots: Date[], tz: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const s of slots) {
    const day = dateInTz(s, tz);
    (out[day] ??= []).push(s.toISOString());
  }
  return out;
}

/** Vero se `start` e' esattamente uno degli slot liberi calcolati con queste regole. */
export function isSlotAvailable(rules: SlotRules, busy: BusyInterval[], start: Date, now: Date = new Date()): boolean {
  const windowStart = new Date(start.getTime() - 1);
  const windowEnd = new Date(start.getTime() + 1);
  return computeSlots(rules, busy, windowStart, windowEnd, now).some(s => s.getTime() === start.getTime());
}
