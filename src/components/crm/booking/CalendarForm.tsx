"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Copy } from "lucide-react";
import type { AppointmentLocation, CustomFieldType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { saveCalendar, type CalendarInput } from "@/app/actions/calendars";
import { COMMON_TIMEZONES, DAY_LABELS, LOCATION_LABEL, WEEK_ORDER, slugify } from "@/lib/booking/shared";
import { CONTACT_STANDARD_FIELDS, type FormField } from "@/lib/crm/types";
import { CUSTOM_FIELD_TYPE_LABEL } from "@/lib/crm/customFields";

export type CalendarFormValues = Omit<CalendarInput, "questions"> & { questions: FormField[] };

type Props = {
  slug: string;
  initial: CalendarFormValues;
  members: { userId: string; name: string; email: string | null }[];
  googleHosts: string[];
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  tags: { id: string; name: string; color: string }[];
  customFields: { key: string; label: string }[];
};

const card = "bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4";
const inputCls = "w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface focus:outline-none focus:border-info";
const labelCls = "block text-[12px] font-medium text-fg-2 mb-1";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function NumberField({ label, value, onChange, min, max, hint }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="number" className={inputCls} value={value} min={min} max={max} onChange={e => onChange(Number(e.target.value))} />
      {hint && <p className="text-[11px] text-fg-3 mt-1">{hint}</p>}
    </div>
  );
}

export function CalendarForm({ slug, initial, members, googleHosts, pipelines, tags, customFields }: Props) {
  const router = useRouter();
  const [v, setV] = useState<CalendarFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof CalendarFormValues>(k: K, val: CalendarFormValues[K]) => setV(prev => ({ ...prev, [k]: val }));
  const hostHasGoogle = googleHosts.includes(v.hostUserId);
  const pipeline = pipelines.find(p => p.id === v.pipelineId);

  function setRanges(day: number, ranges: { startTime: string; endTime: string }[]) {
    setV(prev => ({
      ...prev,
      availability: [...prev.availability.filter(a => a.dayOfWeek !== day), ...ranges.map(r => ({ dayOfWeek: day, ...r }))],
    }));
  }

  function copyToWeekdays(day: number) {
    const src = v.availability.filter(a => a.dayOfWeek === day);
    setV(prev => ({
      ...prev,
      availability: [
        ...prev.availability.filter(a => a.dayOfWeek === 0 || a.dayOfWeek === 6 || a.dayOfWeek === day),
        ...[1, 2, 3, 4, 5].filter(d => d !== day).flatMap(d => src.map(r => ({ dayOfWeek: d, startTime: r.startTime, endTime: r.endTime }))),
      ],
    }));
  }

  function setQuestion(i: number, patch: Partial<FormField>) {
    setV(prev => ({ ...prev, questions: prev.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveCalendar(slug, v);
      if (!r.ok) { setError(r.error); return; }
      router.push(`/${slug}/calendars`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <section className={card}>
        <h2 className="text-[14px] font-semibold text-fg">Generale</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} required value={v.name} onChange={e => {
              const name = e.target.value;
              setV(prev => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
            }} placeholder="Consulenza gratuita" />
          </div>
          <div>
            <label className={labelCls}>Slug (URL pubblico) *</label>
            <input className={inputCls} required value={v.slug} onChange={e => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} />
            <p className="text-[11px] text-fg-3 mt-1 break-all">/book/{slug}/{v.slug || "…"}</p>
          </div>
        </div>
        <div>
          <label className={labelCls}>Descrizione</label>
          <textarea className={inputCls} rows={3} value={v.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Cosa succede durante l'appuntamento" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Host (chi riceve) *</label>
            <select className={inputCls} value={v.hostUserId} onChange={e => set("hostUserId", e.target.value)} required>
              <option value="">Seleziona…</option>
              {members.map(m => <option key={m.userId} value={m.userId}>{m.name}{m.email ? ` — ${m.email}` : ""}{googleHosts.includes(m.userId) ? " · Google ✓" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Colore</label>
            <input type="color" className="h-[34px] w-full border border-border rounded-[var(--r-md)] bg-surface" value={v.color} onChange={e => set("color", e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-fg-2">
          <input type="checkbox" checked={v.active} onChange={e => set("active", e.target.checked)} /> Attivo (prenotabile dal link pubblico)
        </label>
      </section>

      <section className={card}>
        <h2 className="text-[14px] font-semibold text-fg">Durata e regole</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField label="Durata (min)" value={v.durationMinutes} min={5} max={1440} onChange={n => set("durationMinutes", n)} />
          <NumberField label="Intervallo slot (min)" value={v.slotIntervalMinutes} min={5} max={1440} onChange={n => set("slotIntervalMinutes", n)} hint="Ogni quanto inizia uno slot" />
          <NumberField label="Buffer (min)" value={v.bufferMinutes} min={0} max={240} onChange={n => set("bufferMinutes", n)} hint="Pausa prima/dopo altri impegni" />
          <NumberField label="Anticipo minimo (ore)" value={v.minAdvanceHours} min={0} max={1440} onChange={n => set("minAdvanceHours", n)} />
          <NumberField label="Prenotabile fino a (giorni)" value={v.maxAdvanceDays} min={1} max={730} onChange={n => set("maxAdvanceDays", n)} />
          <div>
            <label className={labelCls}>Fuso orario</label>
            <select className={inputCls} value={v.timezone} onChange={e => set("timezone", e.target.value)}>
              {(COMMON_TIMEZONES.includes(v.timezone) ? COMMON_TIMEZONES : [v.timezone, ...COMMON_TIMEZONES]).map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-[14px] font-semibold text-fg">Luogo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tipo</label>
            <select className={inputCls} value={v.locationType} onChange={e => set("locationType", e.target.value as AppointmentLocation)}>
              {(Object.keys(LOCATION_LABEL) as AppointmentLocation[]).map(k => <option key={k} value={k}>{LOCATION_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              {v.locationType === "VIDEO" ? "Link fisso (facoltativo)" : v.locationType === "PHONE" ? "Numero (facoltativo: se vuoto chiami tu il contatto)" : v.locationType === "IN_PERSON" ? "Indirizzo" : "Descrizione"}
            </label>
            <input className={inputCls} value={v.locationValue ?? ""} onChange={e => set("locationValue", e.target.value)} />
          </div>
        </div>
        {v.locationType === "VIDEO" && (
          <p className="text-[12px] text-fg-3">
            {hostHasGoogle
              ? "L'host ha Google Calendar collegato: a ogni prenotazione viene creato automaticamente un link Google Meet."
              : "L'host non ha Google Calendar collegato: nessun link Meet automatico. Collega Google dalla pagina Calendari o indica un link fisso."}
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-[14px] font-semibold text-fg">Disponibilità settimanale</h2>
        <p className="text-[12px] text-fg-3 -mt-2">Orari nel fuso {v.timezone}. Più fasce per giorno sono ammesse.</p>
        <div className="divide-y divide-border">
          {WEEK_ORDER.map(day => {
            const ranges = v.availability.filter(a => a.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={day} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="sm:w-28 text-[13px] font-medium text-fg pt-1.5">{DAY_LABELS[day]}</div>
                <div className="flex-1 space-y-2">
                  {ranges.length === 0 && <p className="text-[12px] text-fg-3 pt-1.5">Non disponibile</p>}
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" className={`${inputCls} w-[110px]`} value={r.startTime}
                        onChange={e => setRanges(day, ranges.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
                      <span className="text-fg-3">–</span>
                      <input type="time" className={`${inputCls} w-[110px]`} value={r.endTime}
                        onChange={e => setRanges(day, ranges.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
                      <button type="button" className="p-1.5 text-fg-3 hover:text-danger" aria-label="Rimuovi fascia"
                        onClick={() => setRanges(day, ranges.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button type="button" className="p-1.5 text-fg-3 hover:text-fg" aria-label="Aggiungi fascia" title="Aggiungi fascia"
                    onClick={() => setRanges(day, [...ranges, ranges.length ? { startTime: "14:00", endTime: "18:00" } : { startTime: "09:00", endTime: "13:00" }])}>
                    <Plus className="w-4 h-4" />
                  </button>
                  {day >= 1 && day <= 5 && ranges.length > 0 && (
                    <button type="button" className="p-1.5 text-fg-3 hover:text-fg" title="Copia su tutti i giorni feriali" aria-label="Copia sui feriali"
                      onClick={() => copyToWeekdays(day)}>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-fg">Domande extra</h2>
          <Button type="button" variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => set("questions", [...v.questions, { id: newId(), label: "", type: "TEXT", mapTo: null, required: false }])}>
            Aggiungi
          </Button>
        </div>
        <p className="text-[12px] text-fg-3 -mt-2">Nome, email e telefono sono sempre chiesti. Le risposte si salvano sull&apos;appuntamento e, se mappate, sul contatto.</p>
        {v.questions.map((q, i) => (
          <div key={q.id} className="border border-border rounded-[var(--r-md)] p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px] gap-3">
              <input className={inputCls} placeholder="Testo della domanda" value={q.label} onChange={e => setQuestion(i, { label: e.target.value })} />
              <select className={inputCls} value={q.type} onChange={e => setQuestion(i, { type: e.target.value as CustomFieldType })}>
                {(Object.keys(CUSTOM_FIELD_TYPE_LABEL) as CustomFieldType[]).map(t => <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            {(q.type === "SELECT" || q.type === "MULTISELECT") && (
              <input className={inputCls} placeholder="Opzioni separate da virgola" value={(q.options ?? []).join(", ")}
                onChange={e => setQuestion(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <select className={`${inputCls} w-auto`} value={q.mapTo ?? ""} onChange={e => setQuestion(i, { mapTo: e.target.value || null })}>
                <option value="">Non salvare sul contatto</option>
                <optgroup label="Campi standard">
                  {CONTACT_STANDARD_FIELDS.filter(f => !["firstName", "lastName", "email"].includes(f.key)).map(f => <option key={f.key} value={`std:${f.key}`}>{f.label}</option>)}
                </optgroup>
                {customFields.length > 0 && (
                  <optgroup label="Campi personalizzati">
                    {customFields.map(f => <option key={f.key} value={`cf:${f.key}`}>{f.label}</option>)}
                  </optgroup>
                )}
              </select>
              <label className="flex items-center gap-1.5 text-[12px] text-fg-2">
                <input type="checkbox" checked={q.required} onChange={e => setQuestion(i, { required: e.target.checked })} /> Obbligatoria
              </label>
              <button type="button" className="ml-auto p-1.5 text-fg-3 hover:text-danger" aria-label="Rimuovi domanda"
                onClick={() => set("questions", v.questions.filter((_, j) => j !== i))}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className={card}>
        <h2 className="text-[14px] font-semibold text-fg">CRM</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Crea opportunità nella pipeline</label>
            <select className={inputCls} value={v.pipelineId ?? ""} onChange={e => setV(prev => ({ ...prev, pipelineId: e.target.value || null, stageId: null }))}>
              <option value="">Nessuna opportunità</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fase</label>
            <select className={inputCls} value={v.stageId ?? ""} disabled={!pipeline} onChange={e => set("stageId", e.target.value || null)}>
              <option value="">Prima fase aperta</option>
              {pipeline?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Etichette da applicare al contatto</label>
          {tags.length === 0 ? <p className="text-[12px] text-fg-3">Nessuna etichetta nel CRM.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(t => {
                const on = v.tagIds.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => set("tagIds", on ? v.tagIds.filter(x => x !== t.id) : [...v.tagIds, t.id])}
                    className="px-2.5 py-1 rounded-full text-[12px] border transition-colors"
                    style={{ borderColor: on ? t.color : "var(--border)", backgroundColor: on ? `${t.color}1a` : "transparent", color: on ? t.color : "var(--fg-2)" }}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{initial.id ? "Salva modifiche" : "Crea calendario"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.push(`/${slug}/calendars`)}>Annulla</Button>
      </div>
    </form>
  );
}
