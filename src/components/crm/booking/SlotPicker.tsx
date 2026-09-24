"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import { addDaysStr, dateInTz, isValidTimeZone } from "@/lib/booking/slots";
import { COMMON_TIMEZONES } from "@/lib/booking/shared";

/**
 * Selettore giorno + orario, condiviso da pagina pubblica, link di gestione e
 * admin ("Prenota per questo contatto", "Sposta"). Non sa da dove arrivano gli
 * slot: li chiede a `fetchSlots(from, to, tz)`, che risponde con gli istanti
 * ISO raggruppati per giorno nel fuso `tz`.
 *
 * Mostra sempre il fuso in uso e permette di cambiarlo: il default e' quello
 * del browser (dopo il mount, per non rompere l'idratazione).
 */

export type FetchSlots = (from: string, to: string, tz: string) => Promise<{ days: Record<string, string[]> } | { error: string }>;

type Props = {
  fetchSlots: FetchSlots;
  initialTimezone: string;
  selected: string | null;
  onSelect: (iso: string | null, tz: string) => void;
  accentColor?: string;
  /** Ultimo giorno prenotabile (anticipo massimo), per fermare la navigazione. */
  maxAdvanceDays?: number;
  /** Cambia per forzare un nuovo caricamento (es. dopo "orario non piu' disponibile"). */
  reloadKey?: number;
  variant?: "public" | "admin";
};

const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function monthOf(date: string) {
  return date.slice(0, 7);
}
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
function lastDayOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function browserTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export function SlotPicker({
  fetchSlots, initialTimezone, selected, onSelect, accentColor = "#4f7deb", maxAdvanceDays = 365, reloadKey = 0, variant = "public",
}: Props) {
  const [tz, setTz] = useState(initialTimezone);
  const [tzTouched, setTzTouched] = useState(false);
  const today = dateInTz(new Date(), tz);
  const [month, setMonth] = useState(() => monthOf(dateInTz(new Date(), initialTimezone)));
  const [result, setResult] = useState<{ key: string; days: Record<string, string[]>; error?: string } | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // Fuso del browser dopo il mount (lato server non esiste).
  useEffect(() => {
    if (tzTouched) return;
    const b = browserTimeZone();
    if (b && b !== tz) {
      const id = setTimeout(() => setTz(b), 0);
      return () => clearTimeout(id);
    }
  }, [tz, tzTouched]);

  const maxDate = addDaysStr(today, maxAdvanceDays);
  const from = month === monthOf(today) ? today : `${month}-01`;
  const to = lastDayOf(month) < maxDate ? lastDayOf(month) : maxDate;
  const key = `${from}|${to}|${tz}|${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    if (from > to) {
      Promise.resolve().then(() => { if (!cancelled) setResult({ key, days: {} }); });
      return () => { cancelled = true; };
    }
    fetchSlots(from, to, tz)
      .then(r => { if (!cancelled) setResult("error" in r ? { key, days: {}, error: r.error } : { key, days: r.days }); })
      .catch(() => { if (!cancelled) setResult({ key, days: {}, error: "Impossibile caricare gli orari" }); });
    return () => { cancelled = true; };
  }, [key, from, to, tz, fetchSlots]);

  const loading = result?.key !== key;
  const days = useMemo(() => (loading ? {} : result?.days ?? {}), [loading, result]);
  const availableDays = Object.keys(days).filter(d => days[d]?.length).sort();

  // Giorno mostrato: quello scelto se ha slot, altrimenti il primo disponibile del mese.
  const activeDay = pickedDay && days[pickedDay]?.length ? pickedDay : availableDays[0] ?? null;

  const grid = useMemo(() => {
    const first = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = dom
    const lead = (dow + 6) % 7; // lunedi' primo
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = first; d <= lastDayOf(month); d = addDaysStr(d, 1)) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  const tzOptions = COMMON_TIMEZONES.includes(tz) ? COMMON_TIMEZONES : [tz, ...COMMON_TIMEZONES];
  const canPrev = month > monthOf(today);
  const canNext = shiftMonth(month, 1) <= monthOf(maxDate);
  const monthLabel = formatInTimeZone(new Date(`${month}-15T12:00:00Z`), "UTC", "MMMM yyyy", { locale: it });
  const isPublic = variant === "public";
  const muted = isPublic ? "#6b7280" : "var(--fg-3)";
  const border = isPublic ? "#e5e7eb" : "var(--border)";
  const text = isPublic ? "#111827" : "var(--fg)";

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button" disabled={!canPrev} onClick={() => { setMonth(shiftMonth(month, -1)); setPickedDay(null); }}
            className="p-1.5 rounded-md disabled:opacity-30" style={{ color: text }} aria-label="Mese precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-semibold capitalize" style={{ color: text }}>{monthLabel}</span>
          <button
            type="button" disabled={!canNext} onClick={() => { setMonth(shiftMonth(month, 1)); setPickedDay(null); }}
            className="p-1.5 rounded-md disabled:opacity-30" style={{ color: text }} aria-label="Mese successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-[11px] uppercase py-1" style={{ color: muted }}>{w}</div>
          ))}
          {grid.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const has = !!days[d]?.length;
            const active = d === activeDay;
            return (
              <button
                key={d}
                type="button"
                disabled={!has}
                onClick={() => setPickedDay(d)}
                className="aspect-square rounded-full text-[13px] font-medium transition-colors disabled:cursor-default"
                style={{
                  backgroundColor: active ? accentColor : has ? `${accentColor}1a` : "transparent",
                  color: active ? "#fff" : has ? accentColor : muted,
                  opacity: has || loading ? 1 : 0.45,
                }}
                aria-pressed={active}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: muted }}>
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span className="sr-only">Fuso orario</span>
          <select
            value={tz}
            onChange={e => { setTzTouched(true); setTz(e.target.value); onSelect(null, e.target.value); }}
            className="bg-transparent border rounded-md px-2 py-1 text-[12px] max-w-full"
            style={{ borderColor: border, color: text }}
          >
            {tzOptions.map(z => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </label>
      </div>

      <div>
        {loading ? (
          <p className="text-[13px]" style={{ color: muted }}>Caricamento orari…</p>
        ) : result?.error ? (
          <p className="text-[13px] text-red-600">{result.error}</p>
        ) : !activeDay ? (
          <p className="text-[13px]" style={{ color: muted }}>
            Nessun orario disponibile in questo mese.{canNext ? " Prova il mese successivo." : ""}
          </p>
        ) : (
          <>
            <p className="text-[13px] font-medium mb-2 capitalize" style={{ color: text }}>
              {formatInTimeZone(new Date(days[activeDay][0]), tz, "EEEE d MMMM", { locale: it })}
            </p>
            <div className="grid grid-cols-3 md:grid-cols-1 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {days[activeDay].map(iso => {
                const on = iso === selected;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(iso, tz)}
                    className="py-2 rounded-md border text-[13px] font-medium transition-colors"
                    style={{
                      borderColor: on ? accentColor : `${accentColor}66`,
                      backgroundColor: on ? accentColor : "transparent",
                      color: on ? "#fff" : accentColor,
                    }}
                  >
                    {formatInTimeZone(new Date(iso), tz, "HH:mm")}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
