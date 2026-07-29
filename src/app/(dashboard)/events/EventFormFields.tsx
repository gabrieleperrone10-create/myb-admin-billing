"use client";
import { useState } from "react";
import type { EventType, RecurrenceType } from "@prisma/client";

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "LIVE", label: "Live" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "WEBINAR", label: "Webinar" },
  { value: "RECORDING", label: "Registrazione" },
];

const RECURRENCES: { value: RecurrenceType; label: string }[] = [
  { value: "ONE_TIME", label: "Una tantum" },
  { value: "DAILY", label: "Giornaliero" },
  { value: "WEEKLY", label: "Settimanale" },
  { value: "MONTHLY", label: "Mensile" },
  { value: "CUSTOM", label: "Personalizzato (ogni N giorni)" },
];

function toLocalDatetime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function EventFormFields({ defaults }: {
  defaults?: {
    title?: string;
    type?: EventType;
    date?: Date;
    endDate?: Date | null;
    description?: string;
    location?: string;
    meetUrl?: string;
    recurrence?: RecurrenceType;
    recurrenceInterval?: number | null;
    recurrenceEndDate?: Date | null;
  };
}) {
  const [recurrence, setRecurrence] = useState<RecurrenceType>(defaults?.recurrence ?? "ONE_TIME");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo *</label>
        <input name="title" required defaultValue={defaults?.title} placeholder="es. Live Q&A Marketing"
          className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
          style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Tipo *</label>
          <select name="type" required defaultValue={defaults?.type ?? "LIVE"}
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "#fff" }}>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Ricorrenza</label>
          <select name="recurrence" value={recurrence} onChange={e => setRecurrence(e.target.value as RecurrenceType)}
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "#fff" }}>
            {RECURRENCES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {recurrence === "CUSTOM" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Ogni (giorni) *</label>
            <input name="recurrenceInterval" type="number" min={1} required
              defaultValue={defaults?.recurrenceInterval ?? 7}
              className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Fine ricorrenza</label>
            <input name="recurrenceEndDate" type="date"
              defaultValue={defaults?.recurrenceEndDate ? toLocalDatetime(defaults.recurrenceEndDate).split("T")[0] : ""}
              className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
          </div>
        </div>
      )}

      {recurrence !== "ONE_TIME" && recurrence !== "CUSTOM" && (
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Fine ricorrenza</label>
          <input name="recurrenceEndDate" type="date"
            defaultValue={defaults?.recurrenceEndDate ? toLocalDatetime(defaults.recurrenceEndDate).split("T")[0] : ""}
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Inizio *</label>
          <input name="date" type="datetime-local" required
            defaultValue={toLocalDatetime(defaults?.date)}
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Fine</label>
          <input name="endDate" type="datetime-local"
            defaultValue={toLocalDatetime(defaults?.endDate)}
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
        </div>
      </div>

      <div>
        <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione</label>
        <textarea name="description" rows={2} defaultValue={defaults?.description ?? ""}
          placeholder="Argomenti, agenda..."
          className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
          style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Luogo</label>
          <input name="location" defaultValue={defaults?.location ?? ""} placeholder="es. Sala riunioni"
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Link meeting</label>
          <input name="meetUrl" type="url" defaultValue={defaults?.meetUrl ?? ""} placeholder="https://meet.google.com/..."
            className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
        </div>
      </div>
    </div>
  );
}
