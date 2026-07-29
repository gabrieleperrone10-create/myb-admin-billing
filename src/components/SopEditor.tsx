"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Code2, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Link2, Video, Table as TableIcon, Minus,
  Undo, Redo,
} from "lucide-react";
import { useCallback } from "react";

const ToolbarBtn = ({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={e => { e.preventDefault(); onClick(); }}
    title={title}
    className="p-1.5 rounded-[4px] transition-colors"
    style={{
      backgroundColor: active ? "var(--fg)" : "transparent",
      color: active ? "#fff" : "var(--fg-2)",
    }}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border)" }} />
);

export function SopEditor({
  content,
  onChange,
  readonly = false,
}: {
  content?: object;
  onChange?: (json: object) => void;
  readonly?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: readonly }),
      Youtube.configure({ height: 480, addPasteHandler: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Scrivi la procedura..." }),
    ],
    content: content ?? {},
    editable: !readonly,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    editorProps: {
      attributes: {
        class: "outline-none min-h-[300px] prose prose-sm max-w-none",
      },
    },
  });

  const addYoutube = useCallback(() => {
    const url = prompt("URL YouTube o Vimeo:");
    if (url && editor) editor.commands.setYoutubeVideo({ src: url });
  }, [editor]);

  const addLink = useCallback(() => {
    const url = prompt("URL link:");
    if (url && editor) editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const addTable = useCallback(() => {
    if (editor) editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {!readonly && (
        <div
          className="flex items-center flex-wrap gap-0.5 px-2 py-1.5"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}
        >
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Annulla"><Undo className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Ripeti"><Redo className="w-3.5 h-3.5" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Titolo 1"><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Titolo 2"><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Titolo 3"><Heading3 className="w-3.5 h-3.5" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Grassetto"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Corsivo"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Sottolineato"><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Barrato"><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Evidenzia"><Highlighter className="w-3.5 h-3.5" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Allinea sinistra"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centra"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Allinea destra"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista"><List className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerata"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Citazione"><Quote className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Codice inline"><Code className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Blocco codice"><Code2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <Divider />
          <ToolbarBtn onClick={addLink} active={editor.isActive("link")} title="Inserisci link"><Link2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={addYoutube} title="Embed video YouTube/Vimeo"><Video className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={addTable} title="Inserisci tabella"><TableIcon className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separatore"><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
      )}
      <div className="px-5 py-4 bg-white">
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--fg-3);
          pointer-events: none;
          height: 0;
        }
        .ProseMirror h1 { font-size: 1.6rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 0.8rem 0 0.4rem; }
        .ProseMirror h3 { font-size: 1.05rem; font-weight: 600; margin: 0.6rem 0 0.3rem; }
        .ProseMirror ul { list-style: disc; padding-left: 1.4rem; margin: 0.4rem 0; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.4rem; margin: 0.4rem 0; }
        .ProseMirror li { margin: 0.15rem 0; }
        .ProseMirror blockquote { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--fg-3); margin: 0.5rem 0; }
        .ProseMirror code { background: var(--subtle); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
        .ProseMirror pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 0.5rem 0; }
        .ProseMirror pre code { background: none; padding: 0; color: inherit; }
        .ProseMirror a { color: #4f7deb; text-decoration: underline; }
        .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
        .ProseMirror th, .ProseMirror td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; font-size: 13px; }
        .ProseMirror th { background: var(--subtle); font-weight: 600; }
        .ProseMirror mark { background: #fef08a; border-radius: 2px; padding: 0 2px; }
        .ProseMirror iframe { width: 100%; aspect-ratio: 16/9; border-radius: 6px; margin: 0.5rem 0; }
        .ProseMirror hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
        .ProseMirror p { margin: 0.2rem 0; line-height: 1.65; }
      `}</style>
    </div>
  );
}
