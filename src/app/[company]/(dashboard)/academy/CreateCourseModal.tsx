"use client";
import { useState } from "react";
import { createCourse } from "@/app/actions/academy";
import { Plus, X } from "lucide-react";

export function CreateCourseModal({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await createCourse({
      categoryId: fd.get("categoryId") as string,
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || undefined,
    });
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium"
        style={{ backgroundColor: "var(--fg)", color: "#fff" }}
      >
        <Plus className="w-3.5 h-3.5" /> Nuovo corso
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-md rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuovo corso</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Categoria *</label>
                <select
                  name="categoryId"
                  required
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "#fff" }}
                >
                  <option value="">Seleziona...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo *</label>
                <input
                  name="title"
                  required
                  placeholder="es. Fondamenti del Marketing"
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Descrizione breve del corso..."
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
                  {loading ? "..." : "Crea corso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
