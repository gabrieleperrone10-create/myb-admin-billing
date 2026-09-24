"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import type { CustomFieldType } from "@prisma/client";
import { formatFieldValue, type CustomFieldValue } from "@/lib/crm/customFields";

type SaveResult = { ok: boolean; error?: string };

function toDraftString(type: CustomFieldType, value: CustomFieldValue): string {
  if (value === null || value === undefined) return type === "CHECKBOX" ? "false" : "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

/**
 * Editor inline per un campo personalizzato: legge il tipo da CustomFieldDef
 * e mostra l'input adatto (testo, numero, data, sì/no, scelta singola/multipla,
 * ecc). Il salvataggio manda sempre una stringa grezza: la validazione/coercizione
 * vera (coerceFieldValue) resta lato server in contactDetail.ts.
 */
export function CustomFieldEditor({
  def,
  value,
  onSave,
}: {
  def: { key: string; label: string; type: CustomFieldType; options: string[]; required: boolean };
  value: CustomFieldValue;
  onSave: (raw: string) => Promise<SaveResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraftString(def.type, value));
  const [multi, setMulti] = useState<string[]>(() => (Array.isArray(value) ? value.map(String) : []));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit() {
    // Il draft parte sempre dal valore attuale del server (non da uno stantio
    // rimasto in stato locale): utile se nel frattempo il campo e' cambiato
    // altrove e la pagina si e' aggiornata con un nuovo `value`.
    setDraft(toDraftString(def.type, value));
    setMulti(Array.isArray(value) ? value.map(String) : []);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(toDraftString(def.type, value));
    setMulti(Array.isArray(value) ? value.map(String) : []);
    setError(null);
    setEditing(false);
  }

  function save(raw: string) {
    setError(null);
    startTransition(async () => {
      const res = await onSave(raw);
      if (!res.ok) {
        setError(res.error ?? "Errore");
        return;
      }
      setEditing(false);
    });
  }

  const display = formatFieldValue(def.type, value) || undefined;

  if (!editing) {
    return (
      <div className="group flex items-center justify-between gap-2 min-h-[30px]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium" style={{ color: "var(--fg-3)" }}>{def.label}</p>
          {display ? (
            <p className="text-[13px] truncate" style={{ color: "var(--fg)" }}>{display}</p>
          ) : (
            <p className="text-[13px] italic" style={{ color: "var(--fg-3)" }}>Non impostato</p>
          )}
        </div>
        <button
          type="button"
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-[4px]"
          style={{ color: "var(--fg-3)" }}
          aria-label={`Modifica ${def.label}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" };
  const inputClass = "flex-1 min-w-0 px-2 py-1 text-[13px] rounded-[6px] border outline-none focus:ring-1";

  let control: React.ReactNode;
  switch (def.type) {
    case "TEXTAREA":
      control = (
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={pending}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      );
      break;
    case "CHECKBOX":
      control = (
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={draft === "true"}
            onChange={e => setDraft(e.target.checked ? "true" : "false")}
            disabled={pending}
          />
          Sì
        </label>
      );
      break;
    case "SELECT":
      control = (
        <select
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={pending}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">— nessuna —</option>
          {def.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case "MULTISELECT":
      control = (
        <div className="flex flex-wrap gap-2">
          {def.options.map(o => {
            const checked = multi.includes(o);
            return (
              <label key={o} className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-[6px] border" style={{ borderColor: "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={pending}
                  onChange={e => setMulti(prev => (e.target.checked ? [...prev, o] : prev.filter(x => x !== o)))}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
      break;
    case "DATE":
      control = (
        <input
          autoFocus
          type="date"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={pending}
          className={inputClass}
          style={inputStyle}
        />
      );
      break;
    case "NUMBER":
      control = (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={pending}
          className={inputClass}
          style={inputStyle}
        />
      );
      break;
    default:
      control = (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={pending}
          className={inputClass}
          style={inputStyle}
        />
      );
  }

  const rawToSave = def.type === "MULTISELECT" ? multi.join(",") : draft;

  return (
    <div className="min-h-[30px]">
      <p className="text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>{def.label}</p>
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">{control}</div>
        <button type="button" onClick={() => save(rawToSave)} disabled={pending} className="p-1 rounded-[4px]" style={{ color: "var(--ok)" }} aria-label="Salva">
          <Check className="w-4 h-4" />
        </button>
        <button type="button" onClick={cancel} disabled={pending} className="p-1 rounded-[4px]" style={{ color: "var(--fg-3)" }} aria-label="Annulla">
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
