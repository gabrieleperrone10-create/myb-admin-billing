"use client";
import { useState } from "react";
import { deleteCourse, updateCourse } from "@/app/actions/academy";
import { useCompanySlug } from "@/lib/useCompany";
import { Trash2, Edit2, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteCourseButton({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const slug = useCompanySlug();
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Eliminare "${courseTitle}"? Verranno eliminati tutti i moduli e le lezioni.`)) return;
    setDeleting(true);
    await deleteCourse(slug, courseId);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="absolute top-2 right-2 p-1.5 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ backgroundColor: "#fff", border: "1px solid var(--border)", color: "#dc2626" }}
      title="Elimina corso"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

export function EditCourseButton({
  courseId,
  defaults,
}: {
  courseId: string;
  defaults: { title: string; description?: string | null };
}) {
  const slug = useCompanySlug();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await updateCourse(slug, courseId, {
      title: fd.get("title") as string,
      description: (fd.get("description") as string) || undefined,
    });
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); setOpen(true); }}
        className="absolute top-2 left-2 p-1.5 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: "#fff", border: "1px solid var(--border)", color: "var(--fg-2)" }}
        title="Modifica corso"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-md rounded-[10px] p-6 space-y-4" style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Modifica corso</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo *</label>
                <input name="title" required defaultValue={defaults.title}
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione</label>
                <textarea name="description" rows={3} defaultValue={defaults.description ?? ""}
                  className="w-full px-3 py-2 rounded-[6px] text-[13px] outline-none resize-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)" }} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
                  {loading ? "..." : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
