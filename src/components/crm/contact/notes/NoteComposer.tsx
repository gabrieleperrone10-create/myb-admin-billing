"use client";

import { addContactNote } from "@/app/actions/contactDetail";
import { NoteEditor } from "./NoteEditor";

/** Composer nota nuova, in cima alla tab Attivita'. */
export function NoteComposer({ slug, contactId }: { slug: string; contactId: string }) {
  return (
    <NoteEditor
      placeholder="Scrivi una nota sul contatto…"
      submitLabel="Salva nota"
      onSubmit={html => addContactNote(slug, contactId, html)}
    />
  );
}
