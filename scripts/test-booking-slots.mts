/**
 * Test del calcolo slot (modulo puro, niente DB).
 *   npx tsx scripts/test-booking-slots.mts
 */
import {
  computeSlots, groupSlotsByDay, isSlotAvailable, zonedRange, timeInTz, dateInTz,
  type SlotRules,
} from "../src/lib/booking/slots.js";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FALLITO"}  ${name}${detail ? "  — " + detail : ""}`);
  if (ok) pass++; else fail++;
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const ROME = "Europe/Rome";
const base: SlotRules = {
  timezone: ROME,
  availability: [1, 2, 3, 4, 5, 6, 0].map(d => ({ dayOfWeek: d, startTime: "09:00", endTime: "12:00" })),
  durationMinutes: 60,
  slotIntervalMinutes: 30,
  bufferMinutes: 0,
  minAdvanceHours: 0,
  maxAdvanceDays: 365,
};
const now = new Date("2026-01-01T00:00:00Z");
const day = (date: string, rules = base, busy: { start: Date; end: Date }[] = [], tz = ROME, n = now) => {
  const { start, end } = zonedRange(date, date, tz);
  return computeSlots(rules, busy, start, end, n);
};
const hhmm = (slots: Date[], tz = ROME) => slots.map(s => timeInTz(s, tz));

// 1. giornata normale: 09:00-12:00, durata 60, passo 30 → 09:00 09:30 10:00 10:30 11:00
t("giornata base", eq(hhmm(day("2026-03-10")), ["09:00", "09:30", "10:00", "10:30", "11:00"]), hhmm(day("2026-03-10")).join(" "));

// 2. ora legale (29/03/2026 in Italia): 09:00 locale = 07:00Z; il giorno prima = 08:00Z
const before = day("2026-03-28");
const after = day("2026-03-29");
t("prima del cambio d'ora 09:00 = 08:00Z", before[0].toISOString() === "2026-03-28T08:00:00.000Z", before[0].toISOString());
t("dopo il cambio d'ora 09:00 = 07:00Z", after[0].toISOString() === "2026-03-29T07:00:00.000Z", after[0].toISOString());
t("stessi orari locali nel giorno del cambio", eq(hhmm(after), ["09:00", "09:30", "10:00", "10:30", "11:00"]));

// 3. fascia a cavallo del cambio d'ora (01:00-04:00 del 29/03): durano 2 ore vere, nessun orario inesistente
const night: SlotRules = { ...base, availability: [{ dayOfWeek: 0, startTime: "01:00", endTime: "04:00" }] };
const n1 = hhmm(day("2026-03-29", night));
t("notte del cambio (primavera): nessun 02:xx", !n1.some(h => h.startsWith("02")), n1.join(" "));
t("notte del cambio (primavera): 01:00 01:30 03:00", eq(n1, ["01:00", "01:30", "03:00"]), n1.join(" "));

// 4. ritorno all'ora solare (25/10/2026): 09:00 = 08:00Z
const oct = day("2026-10-25");
t("ora solare 09:00 = 08:00Z", oct[0].toISOString() === "2026-10-25T08:00:00.000Z", oct[0].toISOString());
const nightOct: SlotRules = { ...base, availability: [{ dayOfWeek: 0, startTime: "01:00", endTime: "04:00" }] };
const n2 = day("2026-10-25", nightOct);
t("notte del cambio (autunno): slot unici e ordinati", n2.every((s, i) => i === 0 || s > n2[i - 1]) && new Set(n2.map(String)).size === n2.length, hhmm(n2).join(" "));

// 5. appuntamento esistente 10:00-11:00 → liberi 09:00 e 11:00 soltanto
const busy = [{ start: new Date("2026-03-10T09:00:00Z"), end: new Date("2026-03-10T10:00:00Z") }]; // 10-11 Roma
t("occupato 10-11", eq(hhmm(day("2026-03-10", base, busy)), ["09:00", "11:00"]), hhmm(day("2026-03-10", base, busy)).join(" "));

// 6. buffer 15': 09:00 (finisce 10:00, buffer fino 10:15 non tocca 10:00? tocca: busy allargato 09:45-11:15)
const withBuf = hhmm(day("2026-03-10", { ...base, bufferMinutes: 15 }, busy));
t("buffer 15 esclude slot adiacenti", eq(withBuf, []), withBuf.join(" "));
const withBuf2 = hhmm(day("2026-03-10", { ...base, bufferMinutes: 15, availability: [{ dayOfWeek: 2, startTime: "08:00", endTime: "13:00" }] }, busy));
t("buffer 15 con fascia larga", eq(withBuf2, ["08:00", "08:30", "11:30", "12:00"]), withBuf2.join(" "));

// 7. anticipo minimo: ora = 10/03 09:10 Roma (08:10Z), min 1h → primo slot 10:30
const now2 = new Date("2026-03-10T08:10:00Z");
const adv = hhmm(day("2026-03-10", { ...base, minAdvanceHours: 1 }, [], ROME, now2));
t("anticipo minimo", eq(adv, ["10:30", "11:00"]), adv.join(" "));

// 8. anticipo massimo: 2 giorni → il giorno +5 e' vuoto
t("anticipo massimo", day("2026-03-15", { ...base, maxAdvanceDays: 2 }, [], ROME, new Date("2026-03-10T00:00:00Z")).length === 0);

// 9. fuso del visitatore: New York, raggruppamento per giorno locale
const { start: ws, end: we } = zonedRange("2026-03-10", "2026-03-10", "America/New_York");
const ny = computeSlots(base, [], ws, we, now);
const grouped = groupSlotsByDay(ny, "America/New_York");
t("fuso visitatore: tutti nel giorno richiesto", Object.keys(grouped).every(d => d === "2026-03-10"), Object.keys(grouped).join(","));
t("fuso visitatore: 09:00 Roma = 04:00 New York", timeInTz(new Date(grouped["2026-03-10"][0]), "America/New_York") === "04:00");

// 10. isSlotAvailable
t("slot valido riconosciuto", isSlotAvailable(base, [], new Date("2026-03-10T08:00:00Z"), now));
t("orario fuori griglia rifiutato", !isSlotAvailable(base, [], new Date("2026-03-10T08:10:00Z"), now));
t("slot occupato rifiutato", !isSlotAvailable(base, busy, new Date("2026-03-10T09:00:00Z"), now));

// 11. piu' fasce nello stesso giorno + disponibilita' assente
const split: SlotRules = { ...base, durationMinutes: 30, availability: [
  { dayOfWeek: 2, startTime: "09:00", endTime: "10:00" },
  { dayOfWeek: 2, startTime: "15:00", endTime: "16:00" },
] };
t("piu' fasce nel giorno", eq(hhmm(day("2026-03-10", split)), ["09:00", "09:30", "15:00", "15:30"]));
t("giorno senza disponibilita'", day("2026-03-11", split).length === 0);

// 12. finestra di un mese intero: date in ordine e coerenti
const m = zonedRange("2026-03-01", "2026-03-31", ROME);
const month = computeSlots(base, [], m.start, m.end, now);
t("mese: 31 giorni x 5 slot", month.length === 31 * 5, String(month.length));
t("mese: nessuno slot fuori finestra", month.every(s => dateInTz(s, ROME) >= "2026-03-01" && dateInTz(s, ROME) <= "2026-03-31"));

console.log(`\n${pass} ok, ${fail} falliti`);
if (fail) process.exit(1);
