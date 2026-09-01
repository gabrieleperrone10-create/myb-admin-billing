"use client";
import { useState } from "react";
import { createTeamMember } from "@/app/actions/team";
import { Plus, X } from "lucide-react";
import type { Tag } from "@prisma/client";

export function AddTeamMemberModal({ tags }: { tags: Tag[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await createTeamMember({
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      role: (fd.get("role") as string) || undefined,
      tagIds: selectedTags,
    });
    setLoading(false);
    setOpen(false);
    setSelectedTags([]);
  }

  const toggleTag = (id: string) =>
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium"
        style={{ backgroundColor: "var(--fg)", color: "#fff" }}
      >
        <Plus className="w-3.5 h-3.5" /> Nuovo membro
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-md rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Aggiungi membro</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { name: "name", label: "Nome *", placeholder: "Mario Rossi" },
                { name: "email", label: "Email *", placeholder: "mario@email.com" },
                { name: "role", label: "Ruolo", placeholder: "es. Designer" },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>{f.label}</label>
                  <input
                    name={f.name}
                    required={f.label.includes("*")}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                    style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "#fff" }}
                  />
                </div>
              ))}
              {tags.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Tag</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className="text-[11px] font-mono font-semibold px-2 py-1 rounded-full transition-opacity"
                        style={{
                          backgroundColor: selectedTags.includes(tag.id) ? tag.color : tag.color + "18",
                          color: selectedTags.includes(tag.id) ? "#fff" : tag.color,
                          border: `1px solid ${tag.color}40`,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
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
