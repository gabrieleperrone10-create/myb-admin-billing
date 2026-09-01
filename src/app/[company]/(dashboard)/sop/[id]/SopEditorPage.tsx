"use client";
import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { updateSop, addSopAttachmentLink, addSopAttachmentFile, deleteSopAttachment } from "@/app/actions/sop";
import {
  Save, Eye, EyeOff, Link2, Upload, Trash2, FileText,
  ExternalLink, Paperclip, Tag, FolderOpen, Users, Check,
} from "lucide-react";
import type { Sop, SopFolder, SopTag, SopAttachment, SopSopTag } from "@prisma/client";

const SopEditor = dynamic(() => import("@/components/SopEditor").then(m => ({ default: m.SopEditor })), { ssr: false });

type SopFull = Sop & {
  folder: SopFolder | null;
  tags: (SopSopTag & { tag: SopTag })[];
  attachments: SopAttachment[];
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export function SopEditorPage({
  sop,
  folders,
  allTags,
}: {
  sop: SopFull;
  folders: SopFolder[];
  allTags: SopTag[];
}) {
  const [title, setTitle] = useState(sop.title);
  const [content, setContent] = useState<object>(sop.content as object ?? {});
  const [published, setPublished] = useState(sop.published);
  const [folderId, setFolderId] = useState(sop.folderId ?? "");
  const [roles, setRoles] = useState(sop.roles.join(", "));
  const [selectedTags, setSelectedTags] = useState<string[]>(sop.tags.map(t => t.tagId));
  const [attachments, setAttachments] = useState<SopAttachment[]>(sop.attachments);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleTag = (id: string) =>
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  async function save() {
    setSaving(true);
    try {
      const result = await updateSop(sop.id, {
        title,
        content: JSON.parse(JSON.stringify(content)),
        published,
        folderId: folderId || null,
        roles: roles.split(",").map(r => r.trim()).filter(Boolean),
        tagIds: selectedTags,
      });
      if (!result.ok) {
        alert(`Errore salvataggio: ${result.error}`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Errore salvataggio SOP:", msg);
      alert(`Errore: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkName || !linkUrl) return;
    const att = await addSopAttachmentLink({ sopId: sop.id, name: linkName, url: linkUrl });
    setAttachments(prev => [...prev, att]);
    setLinkName(""); setLinkUrl(""); setAddingLink(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("sopId", sop.id);
    fd.append("file", file);
    const att = await addSopAttachmentFile(fd);
    setAttachments(prev => [...prev, att]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDeleteAtt(att: SopAttachment) {
    setDeletingId(att.id);
    await deleteSopAttachment(att.id, sop.id, att.type === "FILE" ? att.url : undefined);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 text-[22px] font-semibold outline-none bg-transparent"
          style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}
          placeholder="Titolo SOP..."
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPublished(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium"
            style={{ border: "1px solid var(--border)", backgroundColor: published ? "#3b9e6a18" : "#fff", color: published ? "#3b9e6a" : "var(--fg-2)" }}
          >
            {published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {published ? "Pubblica" : "Bozza"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium"
            style={{ backgroundColor: saved ? "#3b9e6a" : "var(--fg)", color: "#fff" }}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Salvo..." : saved ? "Salvato" : "Salva"}
          </button>
        </div>
      </div>

      {/* Meta: folder, roles, tags */}
      <div className="flex flex-wrap gap-3 items-center p-3 rounded-[8px]" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
          <select value={folderId} onChange={e => setFolderId(e.target.value)}
            className="text-[12px] outline-none bg-transparent" style={{ color: "var(--fg-2)" }}>
            <option value="">Nessuna cartella</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="w-px h-4" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
          <input value={roles} onChange={e => setRoles(e.target.value)} placeholder="Ruoli (es. Marketing, Sales)"
            className="text-[12px] outline-none bg-transparent w-48" style={{ color: "var(--fg-2)" }} />
        </div>
        {allTags.length > 0 && (
          <>
            <div className="w-px h-4" style={{ backgroundColor: "var(--border)" }} />
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
              {allTags.map(tag => (
                <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                  className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: selectedTags.includes(tag.id) ? tag.color : tag.color + "18", color: selectedTags.includes(tag.id) ? "#fff" : tag.color }}>
                  {tag.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Editor */}
      <SopEditor content={content as object} onChange={setContent} />

      {/* Attachments */}
      <div className="rounded-[8px] p-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Allegati</span>
            {attachments.length > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>{attachments.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddingLink(v => !v)} className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
              <Link2 className="w-3 h-3" /> Link
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
              <Upload className="w-3 h-3" /> {uploading ? "Carico..." : "File"}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg" />
          </div>
        </div>

        {addingLink && (
          <form onSubmit={handleAddLink} className="flex items-center gap-2 mb-3 p-3 rounded-[6px]" style={{ backgroundColor: "var(--subtle)" }}>
            <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Nome" required className="flex-1 px-2 py-1.5 rounded-[5px] text-[12px] outline-none" style={{ border: "1px solid var(--border)" }} />
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." required type="url" className="flex-1 px-2 py-1.5 rounded-[5px] text-[12px] outline-none" style={{ border: "1px solid var(--border)" }} />
            <button type="submit" className="px-3 py-1.5 rounded-[5px] text-[12px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>Aggiungi</button>
          </form>
        )}

        {attachments.length === 0 && !addingLink ? (
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun allegato. Aggiungi link o file (PDF, slide, ecc.).</p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-3 px-3 py-2 rounded-[6px]" style={{ backgroundColor: "var(--subtle)" }}>
                {att.type === "FILE" ? <FileText className="w-4 h-4 shrink-0" style={{ color: "#4f7deb" }} /> : <Link2 className="w-4 h-4 shrink-0" style={{ color: "#3b9e6a" }} />}
                <div className="flex-1 min-w-0">
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium truncate block hover:underline" style={{ color: "var(--fg)" }}>{att.name}</a>
                  {att.size && <span className="text-[10px]" style={{ color: "var(--fg-3)" }}>{formatBytes(att.size)}</span>}
                </div>
                <a href={att.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} /></a>
                <button onClick={() => handleDeleteAtt(att)} disabled={deletingId === att.id}><Trash2 className="w-3.5 h-3.5" style={{ color: deletingId === att.id ? "var(--fg-3)" : "#dc2626" }} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
