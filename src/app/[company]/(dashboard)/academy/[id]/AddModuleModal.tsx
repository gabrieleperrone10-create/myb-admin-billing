"use client";
import { useState } from "react";
import { createModule } from "@/app/actions/academy";
import { Folder, X } from "lucide-react";

export function AddModuleModal({
  courseId,
  parentId,
  label = "+ Cartella",
  title = "Nuova cartella",
}: {
  courseId: string;
  parentId?: string;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await createModule({ courseId, parentId, title: fd.get("title") as string });
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); setOpen(true); }}
        className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium"
        style={{ border: "1px solid var(--border)", color: "var(--fg-2)", backgroundColor: "#fff" }}
      >
        <Folder className="w-3 h-3" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>{title}</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome *</label>
                <input
                  name="title"
                  required
                  placeholder={parentId ? "es. Parte 1 — Fondamenti" : "es. Modulo 1 — Introduzione"}
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
                  {loading ? "..." : "Crea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
