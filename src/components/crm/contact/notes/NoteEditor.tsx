"use client";

import { useCallback, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Link2, Send, X } from "lucide-react";

const ToolbarBtn = ({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    title={title}
    className="p-1.5 rounded-[4px] transition-colors"
    style={{ backgroundColor: active ? "var(--fg)" : "transparent", color: active ? "#fff" : "var(--fg-2)" }}
  >
    {children}
  </button>
);

type SaveResult = { ok: boolean; error?: string };

/**
 * Editor Tiptap leggero condiviso da composer (nota nuova) e modifica (nota
 * esistente): grassetto, corsivo, elenchi, link. L'HTML sanificato/salvato
 * resta responsabilita' del server (contactDetail.ts).
 */
export function NoteEditor({
  initialHtml = "",
  placeholder = "Scrivi una nota sul contatto…",
  submitLabel = "Salva nota",
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  initialHtml?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSubmit: (html: string) => Promise<SaveResult>;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus,
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false, strike: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    editorProps: { attributes: { class: "outline-none min-h-[70px] prose prose-sm max-w-none" } },
  });

  const addLink = useCallback(() => {
    const url = prompt("URL link:");
    if (url && editor) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  function submit() {
    if (!editor || editor.isEmpty) return;
    setError(null);
    const html = editor.getHTML();
    startTransition(async () => {
      const res = await onSubmit(html);
      if (!res.ok) { setError(res.error ?? "Errore"); return; }
      editor.commands.clearContent();
    });
  }

  if (!editor) return null;

  return (
    <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
      <div
        className="flex items-center gap-0.5 px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}
      >
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Grassetto">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Corsivo">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Elenco">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Elenco numerato">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={addLink} active={editor.isActive("link")} title="Link">
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
      </div>
      <div className="px-3 py-2">
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
        <p className="text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-[12px] px-2 py-1.5 rounded-[var(--r-md)]"
              style={{ color: "var(--fg-3)" }}
            >
              <X className="w-3.5 h-3.5" /> Annulla
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || editor.isEmpty}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-[var(--r-md)] disabled:opacity-40"
            style={{ backgroundColor: "var(--fg)", color: "#fff" }}
          >
            <Send className="w-3.5 h-3.5" /> {submitLabel}
          </button>
        </div>
      </div>
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); float: left; color: var(--fg-3); pointer-events: none; height: 0;
        }
        .ProseMirror ul { list-style: disc; padding-left: 1.3rem; margin: 0.2rem 0; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.3rem; margin: 0.2rem 0; }
        .ProseMirror a { color: var(--info); text-decoration: underline; }
        .ProseMirror p { margin: 0.15rem 0; }
      `}</style>
    </div>
  );
}
