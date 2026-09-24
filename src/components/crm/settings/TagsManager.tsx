"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createCrmTag, updateCrmTag, deleteCrmTag } from "@/app/actions/crmSettings";

export type TagWithCount = { id: string; name: string; color: string; contactCount: number };

const SWATCHES = ["#4f7deb", "#10b981", "#f97316", "#ef4444", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#64748b"];

export default function TagsManager({ slug, tags }: { slug: string; tags: TagWithCount[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function remove(tag: TagWithCount) {
    const msg = tag.contactCount > 0
      ? `Eliminare l'etichetta "${tag.name}"? Verrà rimossa da ${tag.contactCount} contatt${tag.contactCount === 1 ? "o" : "i"}.`
      : `Eliminare l'etichetta "${tag.name}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      await deleteCrmTag(slug, tag.id);
      refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Etichette</h2>
        {!creating && (
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)}>Nuova etichetta</Button>
        )}
      </div>

      {creating && (
        <div className="p-3 rounded-[var(--r-lg)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
          <TagForm
            slug={slug}
            pending={pending}
            startTransition={startTransition}
            onDone={() => { setCreating(false); refresh(); }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {tags.length === 0 && !creating && (
        <p className="text-[13px] py-4" style={{ color: "var(--fg-3)" }}>Nessuna etichetta ancora.</p>
      )}

      {tags.length > 0 && (
        <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {tags.map((t, i) => (
            <div key={t.id}>
              {editingId === t.id ? (
                <div className="p-3" style={{ borderBottom: i < tags.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: "var(--subtle)" }}>
                  <TagForm
                    slug={slug}
                    editing={t}
                    pending={pending}
                    startTransition={startTransition}
                    onDone={() => { setEditingId(null); refresh(); }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: i < tags.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: "var(--surface)" }}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <p className="flex-1 text-[13px] font-medium" style={{ color: "var(--fg)" }}>{t.name}</p>
                  <span className="text-[11px] font-mono" style={{ color: "var(--fg-3)" }}>{t.contactCount} contatt{t.contactCount === 1 ? "o" : "i"}</span>
                  <button type="button" onClick={() => setEditingId(t.id)} className="p-1.5" style={{ color: "var(--fg-3)" }} aria-label="Modifica"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" disabled={pending} onClick={() => remove(t)} className="p-1.5" style={{ color: "var(--danger)" }} aria-label="Elimina"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TagForm({
  slug, editing, pending, startTransition, onDone, onCancel,
}: {
  slug: string;
  editing?: { id: string; name: string; color: string };
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Il nome è obbligatorio."); return; }
    startTransition(async () => {
      const res = editing
        ? await updateCrmTag(slug, editing.id, { name: name.trim(), color })
        : await createCrmTag(slug, { name: name.trim(), color });
      if (!res.ok) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="Nome etichetta" value={name} onChange={e => setName(e.target.value)} required />
      <div>
        <p className="text-[12px] font-medium mb-1.5" style={{ color: "var(--fg-2)" }}>Colore</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SWATCHES.map(c => (
            <button
              key={c} type="button" onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: c, outline: color === c ? "2px solid var(--fg)" : "none", outlineOffset: 2 }}
              aria-label={c}
            />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded-full border-0 bg-transparent cursor-pointer" />
        </div>
      </div>
      {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>{editing ? "Salva" : "Crea"}</Button>
        <Button type="button" size="sm" variant="secondary" icon={<X className="w-3.5 h-3.5" />} onClick={onCancel}>Annulla</Button>
      </div>
    </form>
  );
}
