"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, CalendarPlus, CheckCircle2, Clock, Download, MapPin, Video } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import type { AppointmentLocation } from "@prisma/client";
import type { FormField } from "@/lib/crm/types";
import { LOCATION_LABEL, manageBookingPath } from "@/lib/booking/shared";
import { googleCalendarTemplateUrl } from "@/lib/booking/ics";
import { SlotPicker, type FetchSlots } from "./SlotPicker";

export type PublicCalendarInfo = {
  companySlug: string;
  calendarSlug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  maxAdvanceDays: number;
  timezone: string;
  locationType: AppointmentLocation;
  /** Solo per IN_PERSON/PHONE/CUSTOM: e' informazione pubblica per scelta dell'azienda. */
  locationValue: string | null;
  questions: FormField[];
};

export type PublicBrand = { name: string; logoUrl: string | null; color: string };

type Done = { startTime: string; endTime: string; videoLink: string | null; manageToken: string };

const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px] text-gray-900 bg-white focus:outline-none focus:ring-2";

function readVisitorId(): string | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = sp.get("vid");
    if (fromUrl) return fromUrl.slice(0, 100);
    // Stesso identificativo di t.js (cookie/localStorage "myb_vid"): presente
    // quando la pagina di booking e' visitata sul dominio dove gira t.js.
    const m = document.cookie.match(/(?:^|;\s*)myb_vid=([^;]+)/);
    if (m) return decodeURIComponent(m[1]).slice(0, 100);
    return localStorage.getItem("myb_vid");
  } catch {
    return null;
  }
}

function readAttribution(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const sp = new URLSearchParams(window.location.search);
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"]) {
      const v = sp.get(k);
      if (v) out[k] = v;
    }
    if (document.referrer) out.referrer = document.referrer;
    out.landingUrl = window.location.href;
  } catch { /* ignorato */ }
  return out;
}

function QuestionInput({ q, value, onChange, color }: { q: FormField; value: unknown; onChange: (v: unknown) => void; color: string }) {
  const common = { id: `q-${q.id}`, required: q.required, className: inputCls, style: { ["--tw-ring-color" as string]: `${color}55` } };
  switch (q.type) {
    case "TEXTAREA":
      return <textarea {...common} rows={3} placeholder={q.placeholder} value={String(value ?? "")} onChange={e => onChange(e.target.value)} />;
    case "SELECT":
      return (
        <select {...common} value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
          <option value="">Seleziona…</option>
          {(q.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "MULTISELECT": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {(q.options ?? []).map(o => (
            <label key={o} className="flex items-center gap-2 text-[14px] text-gray-800">
              <input type="checkbox" checked={arr.includes(o)} onChange={e => onChange(e.target.checked ? [...arr, o] : arr.filter(x => x !== o))} />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 text-[14px] text-gray-800">
          <input type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} required={q.required} />
          Sì
        </label>
      );
    default: {
      const type = q.type === "NUMBER" ? "number" : q.type === "DATE" ? "date" : q.type === "EMAIL" ? "email" : q.type === "PHONE" ? "tel" : q.type === "URL" ? "url" : "text";
      return <input {...common} type={type} placeholder={q.placeholder} value={String(value ?? "")} onChange={e => onChange(e.target.value)} />;
    }
  }
}

export function BookingWidget({ calendar, brand }: { calendar: PublicCalendarInfo; brand: PublicBrand }) {
  const color = brand.color;
  const [selected, setSelected] = useState<string | null>(null);
  const [tz, setTz] = useState(calendar.timezone);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "", website: "" });
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const fetchSlots = useCallback<FetchSlots>(async (from, to, zone) => {
    const p = new URLSearchParams({ company: calendar.companySlug, calendar: calendar.calendarSlug, from, to, tz: zone });
    const res = await fetch(`/api/public/booking/slots?${p}`, { cache: "no-store" });
    const json = await res.json();
    return res.ok ? { days: json.days } : { error: json.error ?? "Errore" };
  }, [calendar.companySlug, calendar.calendarSlug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/public/booking/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: calendar.companySlug,
          calendar: calendar.calendarSlug,
          startTime: selected,
          ...form,
          answers,
          visitorId: readVisitorId(),
          attribution: readAttribution(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Prenotazione non riuscita");
        if (res.status === 409) {
          setSelected(null);
          setReloadKey(k => k + 1);
          setStep("pick");
        }
        return;
      }
      setDone(json.appointment);
      setStep("done");
    } catch {
      setError("Connessione non riuscita, riprova");
    } finally {
      setSending(false);
    }
  }

  const when = (iso: string) => formatInTimeZone(new Date(iso), tz, "EEEE d MMMM yyyy, HH:mm", { locale: it });
  const LocIcon = calendar.locationType === "VIDEO" ? Video : MapPin;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden md:grid md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="p-5 sm:p-6 border-b md:border-b-0 md:border-r border-gray-200">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="max-h-10 max-w-[180px] mb-4" />
          ) : (
            <p className="text-[13px] font-semibold mb-4" style={{ color }}>{brand.name}</p>
          )}
          <h1 className="text-[20px] font-semibold leading-tight">{calendar.name}</h1>
          <div className="mt-3 space-y-2 text-[13px] text-gray-600">
            <p className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" /> {calendar.durationMinutes} minuti</p>
            <p className="flex items-center gap-2">
              <LocIcon className="w-4 h-4 shrink-0" />
              {calendar.locationType === "VIDEO" ? "Videochiamata (link via email)" : calendar.locationValue || LOCATION_LABEL[calendar.locationType]}
            </p>
            {selected && step !== "pick" && (
              <p className="flex items-start gap-2 font-medium" style={{ color }}>
                <CalendarPlus className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="capitalize">{when(selected)}<br /><span className="text-[11px] font-normal text-gray-500 normal-case">{tz}</span></span>
              </p>
            )}
          </div>
          {calendar.description && <p className="mt-4 text-[13px] text-gray-600 whitespace-pre-line">{calendar.description}</p>}
        </aside>

        <main className="p-5 sm:p-6">
          {step === "pick" && (
            <>
              <h2 className="text-[16px] font-semibold mb-4">Scegli giorno e orario</h2>
              {error && <p className="mb-3 text-[13px] text-red-600">{error}</p>}
              <SlotPicker
                fetchSlots={fetchSlots}
                initialTimezone={calendar.timezone}
                selected={selected}
                onSelect={(iso, zone) => { setSelected(iso); setTz(zone); if (iso) { setError(null); setStep("form"); } }}
                accentColor={color}
                maxAdvanceDays={calendar.maxAdvanceDays}
                reloadKey={reloadKey}
              />
            </>
          )}

          {step === "form" && selected && (
            <form onSubmit={submit} className="space-y-4 max-w-md">
              <button type="button" onClick={() => setStep("pick")} className="flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4" /> Cambia orario
              </button>
              <h2 className="text-[16px] font-semibold">I tuoi dati</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-[13px] font-medium text-gray-700">Nome *
                  <input className={`${inputCls} mt-1`} required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
                </label>
                <label className="block text-[13px] font-medium text-gray-700">Cognome
                  <input className={`${inputCls} mt-1`} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
                </label>
              </div>
              <label className="block text-[13px] font-medium text-gray-700">Email *
                <input type="email" className={`${inputCls} mt-1`} required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" />
              </label>
              <label className="block text-[13px] font-medium text-gray-700">Telefono{calendar.locationType === "PHONE" ? " *" : ""}
                <input type="tel" className={`${inputCls} mt-1`} required={calendar.locationType === "PHONE"} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
              </label>
              {calendar.questions.map(q => (
                <div key={q.id} className="block text-[13px] font-medium text-gray-700">
                  <label htmlFor={`q-${q.id}`}>{q.label}{q.required ? " *" : ""}</label>
                  <div className="mt-1"><QuestionInput q={q} value={answers[q.id]} onChange={v => setAnswers({ ...answers, [q.id]: v })} color={color} /></div>
                  {q.helpText && <p className="mt-1 text-[12px] font-normal text-gray-500">{q.helpText}</p>}
                </div>
              ))}
              <label className="block text-[13px] font-medium text-gray-700">Note
                <textarea className={`${inputCls} mt-1`} rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </label>
              {/* honeypot */}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              {error && <p className="text-[13px] text-red-600">{error}</p>}
              <button type="submit" disabled={sending} className="w-full py-3 rounded-lg text-white text-[14px] font-semibold disabled:opacity-60" style={{ backgroundColor: color }}>
                {sending ? "Prenotazione in corso…" : "Conferma prenotazione"}
              </button>
            </form>
          )}

          {step === "done" && done && (
            <div className="text-center py-6 max-w-md mx-auto">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color }} />
              <h2 className="text-[20px] font-semibold">Prenotazione confermata</h2>
              <p className="mt-2 text-[14px] text-gray-600">Ti abbiamo inviato un&apos;email di conferma a <strong>{form.email}</strong>.</p>
              <div className="mt-5 text-left rounded-xl border border-gray-200 p-4 text-[14px] space-y-1.5">
                <p className="font-semibold">{calendar.name}</p>
                <p className="capitalize">{when(done.startTime)}</p>
                <p className="text-[12px] text-gray-500">{tz} · {calendar.durationMinutes} minuti</p>
                {done.videoLink && (
                  <p><a href={done.videoLink} className="underline" style={{ color }} target="_blank" rel="noreferrer">Link della videochiamata</a></p>
                )}
              </div>
              <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href={`/api/public/booking/ics?token=${done.manageToken}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium"
                  style={{ borderColor: color, color }}
                >
                  <Download className="w-4 h-4" /> Aggiungi al calendario (.ics)
                </a>
                <a
                  href={googleCalendarTemplateUrl({
                    title: `${calendar.name} — ${brand.name}`,
                    start: new Date(done.startTime),
                    end: new Date(done.endTime),
                    location: done.videoLink ?? calendar.locationValue ?? undefined,
                  })}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] font-medium"
                  style={{ borderColor: color, color }}
                >
                  <CalendarPlus className="w-4 h-4" /> Google Calendar
                </a>
              </div>
              <a href={manageBookingPath(done.manageToken)} className="mt-5 inline-block text-[13px] text-gray-500 underline">Sposta o annulla</a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
