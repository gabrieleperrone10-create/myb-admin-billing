"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Columns3, X } from "lucide-react";
import { STANDARD_COLUMNS } from "@/lib/crm/contactQuery";
import { buildHref } from "./url";
import { STANDARD_COLUMN_LABELS, type CustomFieldDefLite } from "./types";

export default function ColumnPicker({
  columns,
  customFieldDefs,
}: {
  columns: string[];
  customFieldDefs: CustomFieldDefLite[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function setColumns(next: string[]) {
    router.push(buildHref(pathname, searchParams, { cols: next.length ? next.join(",") : "" }));
  }

  function toggle(key: string) {
    setColumns(columns.includes(key) ? columns.filter(c => c !== key) : [...columns, key]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px]"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <Columns3 className="w-3.5 h-3.5" />
        Colonne
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1.5 w-[240px] max-h-[70vh] overflow-y-auto rounded-[var(--r-lg)] p-3 space-y-2.5 z-30"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>Colonne visibili</p>
            <button type="button" onClick={() => setOpen(false)} style={{ color: "var(--fg-3)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            {STANDARD_COLUMNS.map(key => (
              <label key={key} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-2)" }}>
                <input type="checkbox" checked={columns.includes(key)} onChange={() => toggle(key)} />
                {STANDARD_COLUMN_LABELS[key]}
              </label>
            ))}
          </div>
          {customFieldDefs.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid var(--border)" }} className="pt-2">
                <p className="text-[10px] font-mono uppercase mb-1.5" style={{ color: "var(--fg-3)" }}>Campi personalizzati</p>
                <div className="space-y-1">
                  {customFieldDefs.map(def => {
                    const key = `cf:${def.key}`;
                    return (
                      <label key={def.id} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--fg-2)" }}>
                        <input type="checkbox" checked={columns.includes(key)} onChange={() => toggle(key)} />
                        {def.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
