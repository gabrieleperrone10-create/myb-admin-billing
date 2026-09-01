"use client";
import { useState } from "react";
import { createCategory } from "@/app/actions/academy";
import { useCompanySlug } from "@/lib/useCompany";
import { FolderPlus, X } from "lucide-react";

const COLORS = ["#4f7deb", "#3b9e6a", "#f97316", "#dc2626", "#8b5cf6", "#ec4899", "#0891b2", "#d97706"];

export function CreateCategoryModal() {
  const slug = useCompanySlug();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [color, setColor] = useState(COLORS[0]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await createCategory(slug, { name: fd.get("name") as string, color });
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium"
        style={{ border: "1px solid var(--border)", color: "var(--fg-2)", backgroundColor: "#fff" }}
      >
        <FolderPlus className="w-3.5 h-3.5" /> Categoria
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuova categoria</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome *</label>
                <input
                  name="name"
                  required
                  placeholder="es. Onboarding"
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--fg-2)" }}>Colore</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full"
                      style={{
                        backgroundColor: c,
                        transform: color === c ? "scale(1.2)" : "scale(1)",
                        outline: color === c ? `2px solid ${c}` : "none",
                        outlineOffset: 2,
                        transition: "transform 0.1s",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: color, color: "#fff" }}>
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
