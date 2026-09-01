"use client";
import { useState } from "react";
import { createLesson } from "@/app/actions/academy";
import { Plus, X } from "lucide-react";

export function AddLessonModal({ moduleId, courseId }: { moduleId: string; courseId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await createLesson({
      moduleId,
      courseId,
      title: fd.get("title") as string,
      videoUrl: (fd.get("videoUrl") as string) || undefined,
      duration: fd.get("duration") ? parseInt(fd.get("duration") as string) : undefined,
    });
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); setOpen(true); }}
        className="p-0.5 rounded"
        title="Aggiungi lezione"
        style={{ color: "var(--fg-3)" }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-md rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuova lezione</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo *</label>
                <input
                  name="title"
                  required
                  placeholder="es. Cos'è il Marketing"
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>URL Video (YouTube / Vimeo)</label>
                <input
                  name="videoUrl"
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Durata (min)</label>
                <input
                  name="duration"
                  type="number"
                  placeholder="10"
                  className="w-28 px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
                  {loading ? "..." : "Aggiungi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
