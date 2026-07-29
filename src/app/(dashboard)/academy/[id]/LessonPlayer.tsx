"use client";
import { updateLesson, addAttachmentLink, addAttachmentFile, deleteAttachment } from "@/app/actions/academy";
import { useState, useRef } from "react";
import {
  Eye, EyeOff, Edit2, Save, X, Link2, Paperclip, Trash2,
  FileText, ExternalLink, Upload, Plus,
} from "lucide-react";
import type { Lesson, LessonProgress, LessonAttachment } from "@prisma/client";

type LessonFull = Lesson & { progress: LessonProgress[]; attachments: LessonAttachment[] };

function extractVideoEmbed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?dnt=1`;
  if (url.includes("/embed/")) return url;
  return null;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function LessonPlayer({
  lesson,
  accentColor,
  courseId,
}: {
  lesson: LessonFull;
  accentColor: string;
  courseId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl ?? "");
  const [content, setContent] = useState(lesson.content ?? "");
  const [duration, setDuration] = useState(lesson.duration?.toString() ?? "");
  const [published, setPublished] = useState(lesson.published);
  const [saving, setSaving] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<LessonAttachment[]>(lesson.attachments);
  const [addingLink, setAddingLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const embedUrl = extractVideoEmbed(videoUrl);

  async function save() {
    setSaving(true);
    await updateLesson(lesson.id, courseId, {
      title,
      videoUrl: videoUrl || undefined,
      content: content || undefined,
      duration: duration ? parseInt(duration) : undefined,
      published,
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkName || !linkUrl) return;
    const att = await addAttachmentLink({ lessonId: lesson.id, courseId, name: linkName, url: linkUrl });
    setAttachments(prev => [...prev, att]);
    setLinkName("");
    setLinkUrl("");
    setAddingLink(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("lessonId", lesson.id);
    fd.append("courseId", courseId);
    fd.append("file", file);
    const att = await addAttachmentFile(fd);
    setAttachments(prev => [...prev, att]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDeleteAttachment(att: LessonAttachment) {
    setDeletingId(att.id);
    await deleteAttachment(att.id, courseId, att.type === "FILE" ? att.url : undefined);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Video player */}
      {embedUrl ? (
        <div className="rounded-[8px] overflow-hidden" style={{ aspectRatio: "16/9", backgroundColor: "#000" }}>
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="rounded-[8px] flex items-center justify-center text-[13px]"
          style={{ aspectRatio: "16/9", backgroundColor: "var(--subtle)", border: "1px dashed var(--border)", color: "var(--fg-3)" }}
        >
          {videoUrl ? "URL video non riconosciuto — usa YouTube o Vimeo" : "Nessun video — aggiungi un URL YouTube o Vimeo"}
        </div>
      )}

      {/* Title + edit */}
      <div className="rounded-[8px] p-4 space-y-3" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
        {editing ? (
          <div className="space-y-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full text-[16px] font-semibold px-3 py-2 rounded-[6px] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>URL Video (YouTube / Vimeo)</label>
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Descrizione / note</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={6}
                placeholder="Descrivi gli argomenti trattati, aggiungi note, risorse utili..."
                className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
                style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Durata (minuti)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="10"
                  className="w-24 px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="w-4 h-4" />
                <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>Pubblica lezione</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                <X className="w-3.5 h-3.5" /> Annulla
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium" style={{ backgroundColor: accentColor, color: "#fff" }}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Salvo..." : "Salva"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[18px] font-semibold" style={{ color: "var(--fg)" }}>{lesson.title}</h2>
              <div className="flex items-center gap-2 shrink-0">
                {lesson.duration && (
                  <span className="text-[11px] font-mono" style={{ color: "var(--fg-3)" }}>{lesson.duration} min</span>
                )}
                <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: lesson.published ? "#3b9e6a18" : "#f9741618", color: lesson.published ? "#3b9e6a" : "#c2590a" }}>
                  {lesson.published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {lesson.published ? "Pubblica" : "Bozza"}
                </span>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  <Edit2 className="w-3 h-3" /> Modifica
                </button>
              </div>
            </div>
            {lesson.content && (
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: "var(--fg-2)" }}>{lesson.content}</p>
            )}
          </>
        )}
      </div>

      {/* Attachments */}
      <div className="rounded-[8px] p-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
            <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Materiali</span>
            {attachments.length > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>
                {attachments.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingLink(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px]"
              style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}
            >
              <Link2 className="w-3 h-3" /> Link
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px]"
              style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}
            >
              <Upload className="w-3 h-3" /> {uploading ? "Carico..." : "File"}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.mp4,.mov,.png,.jpg" />
          </div>
        </div>

        {/* Add link form */}
        {addingLink && (
          <form onSubmit={handleAddLink} className="flex items-center gap-2 mb-3 p-3 rounded-[6px]" style={{ backgroundColor: "var(--subtle)" }}>
            <input
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              placeholder="Nome (es. Slide del modulo)"
              required
              className="flex-1 px-2 py-1.5 rounded-[5px] text-[12px] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              required
              type="url"
              className="flex-1 px-2 py-1.5 rounded-[5px] text-[12px] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
            />
            <button type="submit" className="px-3 py-1.5 rounded-[5px] text-[12px] font-medium" style={{ backgroundColor: accentColor, color: "#fff" }}>
              Aggiungi
            </button>
            <button type="button" onClick={() => setAddingLink(false)}>
              <X className="w-4 h-4" style={{ color: "var(--fg-3)" }} />
            </button>
          </form>
        )}

        {/* Attachments list */}
        {attachments.length === 0 && !addingLink ? (
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
            Nessun materiale. Aggiungi link o carica file (PDF, slide, ecc.).
          </p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-3 px-3 py-2 rounded-[6px]"
                style={{ backgroundColor: "var(--subtle)" }}
              >
                {att.type === "FILE" ? (
                  <FileText className="w-4 h-4 shrink-0" style={{ color: "#4f7deb" }} />
                ) : (
                  <Link2 className="w-4 h-4 shrink-0" style={{ color: "#3b9e6a" }} />
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-medium truncate block hover:underline"
                    style={{ color: "var(--fg)" }}
                  >
                    {att.name}
                  </a>
                  {att.size && (
                    <span className="text-[10px]" style={{ color: "var(--fg-3)" }}>{formatBytes(att.size)}</span>
                  )}
                </div>
                <a href={att.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
                </a>
                <button
                  onClick={() => handleDeleteAttachment(att)}
                  disabled={deletingId === att.id}
                  className="shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: deletingId === att.id ? "var(--fg-3)" : "#dc2626" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
