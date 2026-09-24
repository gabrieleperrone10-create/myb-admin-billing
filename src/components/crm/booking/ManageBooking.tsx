"use client";

import { useCallback, useState } from "react";
import { CalendarClock, CheckCircle2, Download, XCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import { SlotPicker, type FetchSlots } from "./SlotPicker";

export type ManageInfo = {
  token: string;
  companySlug: string;
  calendarSlug: string;
  calendarActive: boolean;
  calendarName: string;
  brandName: string;
  logoUrl: string | null;
  color: string;
  timezone: string;
  durationMinutes: number;
  maxAdvanceDays: number;
  startTime: string;
  status: string;
  videoLink: string | null;
  locationLabel: string;
  guestName: string | null;
  isPast: boolean;
};

export function ManageBooking({ info }: { info: ManageInfo }) {
  const color = info.color;
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [state, setState] = useState({ status: info.status, startTime: info.startTime, videoLink: info.videoLink });
  const [selected, setSelected] = useState<string | null>(null);
  const [tz, setTz] = useState(info.timezone);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const active = state.status === "SCHEDULED" || state.status === "CONFIRMED";

  const fetchSlots = useCallback<FetchSlots>(async (from, to, zone) => {
    const p = new URLSearchParams({ company: info.companySlug, calendar: info.calendarSlug, from, to, tz: zone, token: info.token });
    const res = await fetch(`/api/public/booking/slots?${p}`, { cache: "no-store" });
    const json = await res.json();
    return res.ok ? { days: json.days } : { error: json.error ?? "Errore" };
  }, [info.companySlug, info.calendarSlug, info.token]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/booking/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: info.token, ...body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Operazione non riuscita");
        if (res.status === 409) { setSelected(null); setReloadKey(k => k + 1); }
        return;
      }
      setState({ status: json.appointment.status, startTime: json.appointment.startTime, videoLink: json.appointment.videoLink });
      setMessage(body.action === "cancel" ? "Appuntamento annullato. Ti abbiamo inviato una conferma via email." : "Appuntamento spostato. Ti abbiamo inviato i nuovi dettagli via email.");
      setMode("view");
      setSelected(null);
    } catch {
      setError("Connessione non riuscita, riprova");
    } finally {
      setBusy(false);
    }
  }

  const when = (iso: string, zone = tz) => formatInTimeZone(new Date(iso), zone, "EEEE d MMMM yyyy, HH:mm", { locale: it });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8">
        {info.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.logoUrl} alt={info.brandName} className="max-h-10 max-w-[180px] mb-5" />
        ) : (
          <p className="text-[13px] font-semibold mb-5" style={{ color }}>{info.brandName}</p>
        )}
        <h1 className="text-[20px] font-semibold">La tua prenotazione</h1>

        {message && (
          <p className="mt-4 flex items-start gap-2 text-[14px] rounded-lg p-3" style={{ backgroundColor: `${color}14`, color }}>
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-gray-200 p-4 space-y-1.5 text-[14px]">
          <p className="font-semibold">{info.calendarName}</p>
          <p className={`capitalize ${state.status === "CANCELLED" ? "line-through text-gray-400" : ""}`}>{when(state.startTime)}</p>
          <p className="text-[12px] text-gray-500">{tz} · {info.durationMinutes} minuti · {info.locationLabel}</p>
          {state.videoLink && active && (
            <p><a href={state.videoLink} target="_blank" rel="noreferrer" className="underline" style={{ color }}>Link della videochiamata</a></p>
          )}
          {state.status === "CANCELLED" && <p className="text-red-600 font-medium">Annullato</p>}
          {state.status === "COMPLETED" && <p className="text-gray-600 font-medium">Svolto</p>}
          {state.status === "NO_SHOW" && <p className="text-gray-600 font-medium">Non presentato</p>}
        </div>

        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

        {active && !info.isPast && mode === "view" && (
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            {info.calendarActive && (
              <button type="button" onClick={() => setMode("reschedule")} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white text-[14px] font-medium" style={{ backgroundColor: color }}>
                <CalendarClock className="w-4 h-4" /> Sposta
              </button>
            )}
            <button type="button" onClick={() => setMode("cancel")} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-[14px] font-medium text-gray-700">
              <XCircle className="w-4 h-4" /> Annulla
            </button>
            <a href={`/api/public/booking/ics?token=${info.token}`} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-[14px] font-medium text-gray-700">
              <Download className="w-4 h-4" /> .ics
            </a>
          </div>
        )}

        {active && info.isPast && <p className="mt-5 text-[13px] text-gray-500">L&apos;appuntamento è già passato: non è più modificabile da qui.</p>}

        {mode === "reschedule" && (
          <div className="mt-6">
            <h2 className="text-[16px] font-semibold mb-4">Scegli il nuovo orario</h2>
            <SlotPicker
              fetchSlots={fetchSlots}
              initialTimezone={info.timezone}
              selected={selected}
              onSelect={(iso, zone) => { setSelected(iso); setTz(zone); }}
              accentColor={color}
              maxAdvanceDays={info.maxAdvanceDays}
              reloadKey={reloadKey}
            />
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button" disabled={!selected || busy}
                onClick={() => selected && send({ action: "reschedule", startTime: selected })}
                className="px-4 py-2.5 rounded-lg text-white text-[14px] font-medium disabled:opacity-50" style={{ backgroundColor: color }}
              >
                {busy ? "Spostamento…" : selected ? `Conferma: ${when(selected)}` : "Seleziona un orario"}
              </button>
              <button type="button" onClick={() => { setMode("view"); setSelected(null); }} className="px-4 py-2.5 rounded-lg border border-gray-300 text-[14px] text-gray-700">Indietro</button>
            </div>
          </div>
        )}

        {mode === "cancel" && (
          <div className="mt-6 space-y-3">
            <h2 className="text-[16px] font-semibold">Annulla l&apos;appuntamento</h2>
            <label className="block text-[13px] font-medium text-gray-700">Motivo (facoltativo)
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
                className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px]" />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={busy} onClick={() => send({ action: "cancel", reason })} className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-[14px] font-medium disabled:opacity-50">
                {busy ? "Annullamento…" : "Conferma annullamento"}
              </button>
              <button type="button" onClick={() => setMode("view")} className="px-4 py-2.5 rounded-lg border border-gray-300 text-[14px] text-gray-700">Indietro</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
