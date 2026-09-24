"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff, Pencil, Trash2, StickyNote } from "lucide-react";
import { deleteContactNote, toggleContactNotePin, updateContactNote } from "@/app/actions/contactDetail";
import { NoteEditor } from "./NoteEditor";

/**
 * Card di una nota nella cronologia (o nella sezione "appuntate" in cima).
 * Modifica/elimina/pin sono visibili solo se `canEdit` e' true: l'autore o
 * chi ha permesso EDIT su Contatti (vedi canTouchNote in contactDetail.ts).
 */
export function NoteCard({
  slug,
  contactId,
  note,
  authorName,
  timeLabel,
  canEdit,
}: {
  slug: string;
  contactId: string;
  note: { id: string; body: string; pinned: boolean };
  authorName: string;
  timeLabel: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePin() {
    startTransition(async () => {
      const res = await toggleContactNotePin(slug, contactId, note.id, !note.pinned);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Eliminare questa nota?")) return;
    startTransition(async () => {
      const res = await deleteContactNote(slug, contactId, note.id);
      if (!res.ok) setError(res.error);
    });
  }

  if (editing) {
    return (
      <NoteEditor
        initialHtml={note.body}
        submitLabel="Salva modifiche"
        autoFocus
        onSubmit={async html => {
          const res = await updateContactNote(slug, contactId, note.id, html);
          if (res.ok) setEditing(false);
          return res;
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      className="rounded-[var(--r-lg)] p-3"
      style={{ border: note.pinned ? "1px solid var(--warn)" : "1px solid var(--border)", backgroundColor: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
          <StickyNote className="w-3.5 h-3.5" style={{ color: "var(--warn)" }} />
          <span className="font-medium" style={{ color: "var(--fg-2)" }}>{authorName}</span>
          <span>·</span>
          <span>{timeLabel}</span>
          {note.pinned && (
            <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--warn-soft)", color: "var(--warn)" }}>
              Appuntata
            </span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" disabled={pending} onClick={togglePin} className="p-1 rounded-[4px]" style={{ color: "var(--fg-3)" }} aria-label={note.pinned ? "Spunta" : "Appunta"}>
              {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            <button type="button" disabled={pending} onClick={() => setEditing(true)} className="p-1 rounded-[4px]" style={{ color: "var(--fg-3)" }} aria-label="Modifica">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" disabled={pending} onClick={remove} className="p-1 rounded-[4px]" style={{ color: "var(--danger)" }} aria-label="Elimina">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="note-body text-[13px] prose prose-sm max-w-none" style={{ color: "var(--fg)" }} dangerouslySetInnerHTML={{ __html: note.body }} />
      {error && <p className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>{error}</p>}
      <style>{`
        .note-body ul { list-style: disc; padding-left: 1.3rem; }
        .note-body ol { list-style: decimal; padding-left: 1.3rem; }
        .note-body a { color: var(--info); text-decoration: underline; }
        .note-body p { margin: 0.15rem 0; }
      `}</style>
    </div>
  );
}
