"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { CUSTOM_FIELD_TYPE_LABEL } from "@/lib/crm/customFields";
import type { ContactFilters } from "@/lib/crm/types";
import type { MemberOption, TagOption, CustomFieldDefLite } from "./types";

/**
 * Filtri avanzati della lista contatti: etichette, responsabile, fonte,
 * intervallo di creazione e campi personalizzati. Applica tutto insieme con
 * un pulsante "Applica" cosi' ogni modifica non scatena una navigazione.
 */
export default function FiltersPopover({
  filters,
  tags,
  members,
  customFieldDefs,
  sourceOptions,
}: {
  filters: ContactFilters;
  tags: TagOption[];
  members: MemberOption[];
  customFieldDefs: CustomFieldDefLite[];
  sourceOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [tagIds, setTagIds] = useState<string[]>(filters.tagIds ?? []);
  const [ownerUserIds, setOwnerUserIds] = useState<string[]>(filters.ownerUserIds ?? []);
  const [source, setSource] = useState<string[]>(filters.source ?? []);
  const [createdFrom, setCreatedFrom] = useState(filters.createdFrom ?? "");
  const [createdTo, setCreatedTo] = useState(filters.createdTo ?? "");
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(filters.custom ?? {}).map(([k, v]) => [k, String(v)])),
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activeCount = (filters.tagIds?.length ?? 0) + (filters.ownerUserIds?.length ?? 0)
    + (filters.source?.length ?? 0) + (filters.createdFrom ? 1 : 0) + (filters.createdTo ? 1 : 0)
    + Object.keys(filters.custom ?? {}).length;

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
  }

  function apply() {
    const patch: Record<string, string | null> = {
      tags: tagIds.length ? tagIds.join(",") : null,
      owners: ownerUserIds.length ? ownerUserIds.join(",") : null,
      source: source.length ? source.join(",") : null,
      createdFrom: createdFrom || null,
      createdTo: createdTo || null,
    };
    // rimuove tutti i cf_* esistenti e riscrive quelli attivi
    const params = new URLSearchParams(searchParams.toString());
    for (const key of Array.from(params.keys())) if (key.startsWith("cf_")) params.delete(key);
    for (const [k, v] of Object.entries(custom)) if (v) params.set(`cf_${k}`, v);
    for (const [k, v] of Object.entries(patch)) { if (v === null) params.delete(k); else params.set(k, v); }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function reset() {
    setTagIds([]); setOwnerUserIds([]); setSource([]); setCreatedFrom(""); setCreatedTo(""); setCustom({});
    const params = new URLSearchParams(searchParams.toString());
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("cf_") || ["tags", "owners", "source", "createdFrom", "createdTo", "page"].includes(key)) params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const customSourceOptions = useMemo(() => Array.from(new Set([...sourceOptions, ...source])), [sourceOptions, source]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px]"
        style={{ border: "1px solid var(--border)", backgroundColor: activeCount > 0 ? "var(--info-soft)" : "var(--surface)", color: "var(--fg)" }}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtri
        {activeCount > 0 && (
          <span className="text-[10px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: "var(--info)", color: "white" }}>{activeCount}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-[320px] max-h-[70vh] overflow-y-auto rounded-[var(--r-lg)] p-3.5 space-y-3.5 z-30"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>Filtri</p>
            <button type="button" onClick={() => setOpen(false)} style={{ color: "var(--fg-3)" }}><X className="w-4 h-4" /></button>
          </div>

          {tags.length > 0 && (
            <FilterGroup label="Etichette">
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <button
                    key={t.id} type="button" onClick={() => toggle(tagIds, setTagIds, t.id)}
                    className="text-[11px] px-2 py-1 rounded-full border"
                    style={{
                      backgroundColor: tagIds.includes(t.id) ? `${t.color}26` : "transparent",
                      borderColor: tagIds.includes(t.id) ? t.color : "var(--border)",
                      color: tagIds.includes(t.id) ? t.color : "var(--fg-2)",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </FilterGroup>
          )}

          {members.length > 0 && (
            <FilterGroup label="Responsabile">
              <div className="space-y-1">
                {members.map(m => (
                  <label key={m.userId} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-2)" }}>
                    <input type="checkbox" checked={ownerUserIds.includes(m.userId)} onChange={() => toggle(ownerUserIds, setOwnerUserIds, m.userId)} />
                    {m.name}
                  </label>
                ))}
              </div>
            </FilterGroup>
          )}

          {customSourceOptions.length > 0 && (
            <FilterGroup label="Fonte">
              <div className="flex flex-wrap gap-1.5">
                {customSourceOptions.map(s => (
                  <button
                    key={s} type="button" onClick={() => toggle(source, setSource, s)}
                    className="text-[11px] px-2 py-1 rounded-full border font-mono"
                    style={{
                      backgroundColor: source.includes(s) ? "var(--info-soft)" : "transparent",
                      borderColor: source.includes(s) ? "var(--info)" : "var(--border)",
                      color: source.includes(s) ? "var(--info)" : "var(--fg-2)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </FilterGroup>
          )}

          <FilterGroup label="Creato tra">
            <div className="flex items-center gap-2">
              <input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} className="flex-1 px-2 py-1 rounded-[6px] text-[12px]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }} />
              <span style={{ color: "var(--fg-3)" }}>—</span>
              <input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} className="flex-1 px-2 py-1 rounded-[6px] text-[12px]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }} />
            </div>
          </FilterGroup>

          {customFieldDefs.map(def => (
            <FilterGroup key={def.id} label={def.label}>
              {(def.type === "SELECT" || def.type === "MULTISELECT") ? (
                <select
                  value={custom[def.key] ?? ""}
                  onChange={e => setCustom(c => ({ ...c, [def.key]: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-[6px] text-[12px]"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
                >
                  <option value="">Tutti</option>
                  {def.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={custom[def.key] ?? ""}
                  onChange={e => setCustom(c => ({ ...c, [def.key]: e.target.value }))}
                  placeholder={CUSTOM_FIELD_TYPE_LABEL[def.type]}
                  className="w-full px-2 py-1.5 rounded-[6px] text-[12px]"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
                />
              )}
            </FilterGroup>
          ))}

          <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={reset} className="text-[12px]" style={{ color: "var(--fg-3)" }}>Azzera</button>
            <button type="button" onClick={apply} className="px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium text-white" style={{ backgroundColor: "var(--fg)" }}>Applica</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>{label}</p>
      {children}
    </div>
  );
}
