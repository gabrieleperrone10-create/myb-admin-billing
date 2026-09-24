"use client";

import { useState, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { addContactTag, createAndAddContactTag, removeContactTag } from "@/app/actions/contactDetail";

type Tag = { id: string; name: string; color: string };

export function TagsEditor({
  slug,
  contactId,
  currentTags,
  availableTags,
}: {
  slug: string;
  contactId: string;
  currentTags: Tag[];
  availableTags: Tag[];
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = availableTags.filter(t => !currentTags.some(c => c.id === t.id));

  function reset() {
    setAdding(false);
    setSelected("");
    setNewName("");
    setError(null);
  }

  function addExisting() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await addContactTag(slug, contactId, selected);
      if (!res.ok) setError(res.error);
      else reset();
    });
  }

  function addNew() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await createAndAddContactTag(slug, contactId, name);
      if (!res.ok) setError(res.error);
      else reset();
    });
  }

  function remove(tagId: string) {
    startTransition(async () => {
      await removeContactTag(slug, contactId, tagId);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {currentTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => remove(tag.id)}
              disabled={pending}
              aria-label={`Rimuovi ${tag.name}`}
              className="hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {currentTags.length === 0 && (
          <span className="text-[12px] italic" style={{ color: "var(--fg-3)" }}>Nessuna etichetta</span>
        )}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--fg-2)" }}
          >
            <Plus className="w-3 h-3" /> Aggiungi
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 space-y-2 p-2 rounded-[8px]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
          {remaining.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                disabled={pending}
                className="flex-1 min-w-0 px-2 py-1 text-[12px] rounded-[6px] border"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                <option value="">Scegli un&apos;etichetta esistente…</option>
                {remaining.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                type="button"
                onClick={addExisting}
                disabled={pending || !selected}
                className="text-[12px] font-medium px-2 py-1 rounded-[6px]"
                style={{ backgroundColor: "var(--fg)", color: "#fff" }}
              >
                Aggiungi
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Crea nuova etichetta…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addNew(); }}
              disabled={pending}
              className="flex-1 min-w-0 px-2 py-1 text-[12px] rounded-[6px] border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
            <button
              type="button"
              onClick={addNew}
              disabled={pending || !newName.trim()}
              className="text-[12px] font-medium px-2 py-1 rounded-[6px]"
              style={{ backgroundColor: "var(--fg)", color: "#fff" }}
            >
              Crea
            </button>
            <button type="button" onClick={reset} disabled={pending} className="p-1" style={{ color: "var(--fg-3)" }} aria-label="Annulla">
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
