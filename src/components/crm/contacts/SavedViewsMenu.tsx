"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bookmark, Plus, Trash2, X, Users, Lock } from "lucide-react";
import { saveContactView, deleteContactView } from "@/app/actions/contacts";
import type { ContactFilters } from "@/lib/crm/types";
import type { ContactSortKey } from "@/lib/crm/contactQuery";
import type { SavedViewLite } from "./types";

export default function SavedViewsMenu({
  slug,
  views,
  filters,
  columns,
  sort,
  dir,
}: {
  slug: string;
  views: SavedViewLite[];
  filters: ContactFilters;
  columns: string[];
  sort: ContactSortKey;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false); }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function applyView(v: SavedViewLite) {
    const params = new URLSearchParams();
    const f = v.filters as ContactFilters;
    if (f.q) params.set("q", f.q);
    if (f.tagIds?.length) params.set("tags", f.tagIds.join(","));
    if (f.ownerUserIds?.length) params.set("owners", f.ownerUserIds.join(","));
    if (f.source?.length) params.set("source", f.source.join(","));
    if (f.createdFrom) params.set("createdFrom", f.createdFrom);
    if (f.createdTo) params.set("createdTo", f.createdTo);
    if (f.custom) for (const [k, val] of Object.entries(f.custom)) params.set(`cf_${k}`, String(val));
    if (v.columns.length) params.set("cols", v.columns.join(","));
    if (v.sort) { params.set("sort", v.sort.key); params.set("dir", v.sort.dir); }
    params.set("view", v.id);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function save() {
    if (!name.trim()) return;
    startTransition(async () => {
      await saveContactView(slug, { name: name.trim(), filters, columns, sort: { key: sort, dir }, isShared: shared });
      setCreating(false);
      setName("");
      setShared(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Eliminare questa vista salvata?")) return;
    startTransition(async () => {
      await deleteContactView(slug, id);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px]"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <Bookmark className="w-3.5 h-3.5" />
        Viste
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1.5 w-[280px] max-h-[70vh] overflow-y-auto rounded-[var(--r-lg)] p-2.5 space-y-1 z-30"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          {views.length === 0 && !creating && (
            <p className="px-1.5 py-2 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessuna vista salvata</p>
          )}
          {views.map(v => (
            <div key={v.id} className="flex items-center gap-1.5 group">
              <button type="button" onClick={() => applyView(v)} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-left text-[12px] hover:bg-black/5" style={{ color: "var(--fg-2)" }}>
                {v.isShared ? <Users className="w-3 h-3 shrink-0" style={{ color: "var(--fg-3)" }} /> : <Lock className="w-3 h-3 shrink-0" style={{ color: "var(--fg-3)" }} />}
                <span className="truncate">{v.name}</span>
              </button>
              {v.mine && (
                <button type="button" disabled={pending} onClick={() => remove(v.id)} style={{ color: "var(--fg-3)" }} className="opacity-0 group-hover:opacity-100 p-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          <div className="pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
            {!creating ? (
              <button type="button" onClick={() => setCreating(true)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-[12px] hover:bg-black/5" style={{ color: "var(--info)" }}>
                <Plus className="w-3.5 h-3.5" /> Salva vista corrente
              </button>
            ) : (
              <div className="p-1.5 space-y-2">
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nome vista"
                    className="flex-1 px-2 py-1.5 rounded-[6px] text-[12px]"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
                  />
                  <button type="button" onClick={() => setCreating(false)} style={{ color: "var(--fg-3)" }}><X className="w-3.5 h-3.5" /></button>
                </div>
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--fg-2)" }}>
                  <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
                  Condivisa con l&apos;azienda
                </label>
                <button
                  type="button"
                  disabled={pending || !name.trim()}
                  onClick={save}
                  className="w-full px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--fg)" }}
                >
                  {pending ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
