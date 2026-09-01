"use client";
import { useState } from "react";
import { createSop } from "@/app/actions/sop";
import { useCompanySlug } from "@/lib/useCompany";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SopFolder, SopTag } from "@prisma/client";

export function CreateSopModal({ folders, tags }: { folders: SopFolder[]; tags: SopTag[] }) {
  const slug = useCompanySlug();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const router = useRouter();

  const toggleTag = (id: string) =>
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const rolesRaw = (fd.get("roles") as string).trim();
    const sop = await createSop(slug, {
      title: fd.get("title") as string,
      folderId: (fd.get("folderId") as string) || undefined,
      roles: rolesRaw ? rolesRaw.split(",").map(r => r.trim()).filter(Boolean) : [],
      tagIds: selectedTags,
    });
    setLoading(false);
    setOpen(false);
    router.push(`/${slug}/sop/${sop.id}`);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium shrink-0" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
        <Plus className="w-3.5 h-3.5" /> Nuova SOP
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-md rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuova SOP</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo *</label>
                <input name="title" required placeholder="es. Come gestire un nuovo cliente" className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
              </div>
              {folders.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Cartella</label>
                  <select name="folderId" className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "#fff" }}>
                    <option value="">Nessuna cartella</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Ruoli (separati da virgola)</label>
                <input name="roles" placeholder="es. Marketing, Sales, Admin" className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none" style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
              </div>
              {tags.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Tag</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                        className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: selectedTags.includes(tag.id) ? tag.color : tag.color + "18", color: selectedTags.includes(tag.id) ? "#fff" : tag.color, border: `1px solid ${tag.color}40` }}>
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>Annulla</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>{loading ? "..." : "Crea e apri"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
