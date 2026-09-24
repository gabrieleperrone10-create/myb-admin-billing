"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateContactTextField, updateContactEmail, updateContactPhoneField } from "@/app/actions/contactDetail";

type SaveResult = { ok: boolean; error?: string };

/**
 * Campo con modifica inline: mostra il valore, un'icona matita per entrare in
 * modifica, poi Salva/Annulla. Riceve solo dati serializzabili (slug,
 * contactId, nome del campo) e sceglie qui la server action: un Server
 * Component non puo' passare funzioni a un Client Component. La action ritorna
 * `{ ok:false, error }` per mostrare l'errore accanto al campo.
 */
export type InlineContactField = "firstName" | "lastName" | "email" | "phone" | "whatsapp" | "companyName" | "jobTitle";

function saveField(slug: string, contactId: string, field: InlineContactField, value: string): Promise<SaveResult> {
  if (field === "email") return updateContactEmail(slug, contactId, value);
  if (field === "phone" || field === "whatsapp") return updateContactPhoneField(slug, contactId, field, value);
  return updateContactTextField(slug, contactId, field, value);
}
export function InlineTextField({
  label,
  value,
  placeholder = "Non impostato",
  type = "text",
  link,
  slug,
  contactId,
  field,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  /** Se impostato, il valore in sola lettura diventa un link mailto:/tel: */
  link?: "mailto" | "tel";
  slug: string;
  contactId: string;
  field: InlineContactField;
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
      const res = await saveField(slug, contactId, field, draft.trim());
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
            link ? (
              <a href={`${link}:${value}`} className="text-[13px] hover:underline truncate block" style={{ color: "var(--fg)" }}>
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
