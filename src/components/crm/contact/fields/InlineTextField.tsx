"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";

type SaveResult = { ok: boolean; error?: string };

/**
 * Campo con modifica inline: mostra il valore, un'icona matita per entrare in
 * modifica, poi Salva/Annulla. `onSave` e' la server action gia' legata a
 * slug+contactId+campo: ritorna `{ ok:false, error }` per mostrare l'errore
 * accanto al campo invece di far esplodere la pagina.
 */
export function InlineTextField({
  label,
  value,
  placeholder = "Non impostato",
  type = "text",
  href,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  /** Se impostato, il valore in sola lettura diventa un link (es. mailto:/tel:) */
  href?: (value: string) => string;
  onSave: (value: string) => Promise<SaveResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function cancel() {
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await onSave(draft.trim());
      if (!res.ok) {
        setError(res.error ?? "Errore");
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="group flex items-center justify-between gap-2 min-h-[30px]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium" style={{ color: "var(--fg-3)" }}>{label}</p>
          {value ? (
            href ? (
              <a href={href(value)} className="text-[13px] hover:underline truncate block" style={{ color: "var(--fg)" }}>
                {value}
              </a>
            ) : (
              <p className="text-[13px] truncate" style={{ color: "var(--fg)" }}>{value}</p>
            )
          ) : (
            <p className="text-[13px] italic" style={{ color: "var(--fg-3)" }}>{placeholder}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-[4px]"
          style={{ color: "var(--fg-3)" }}
          aria-label={`Modifica ${label}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[30px]">
      <p className="text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>{label}</p>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={pending}
          className="flex-1 min-w-0 px-2 py-1 text-[13px] rounded-[6px] border outline-none focus:ring-1"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
        <button type="button" onClick={save} disabled={pending} className="p-1 rounded-[4px]" style={{ color: "var(--ok)" }} aria-label="Salva">
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
