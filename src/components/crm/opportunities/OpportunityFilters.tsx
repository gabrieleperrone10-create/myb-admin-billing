"use client";

import { useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, KanbanSquare, List as ListIcon, X } from "lucide-react";
import type { MemberData, PipelineData } from "./types";

const STATUS_OPTIONS = [
  { value: "all", label: "Tutte" },
  { value: "open", label: "Aperte" },
  { value: "won", label: "Vinte" },
  { value: "lost", label: "Perse" },
];

export function OpportunityFilters({ pipelines, members }: { pipelines: PipelineData[]; members: MemberData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const set = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, sp]);

  const view = sp.get("view") === "list" ? "list" : "kanban";
  const q = sp.get("q") ?? "";

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-3">
      <select
        value={sp.get("pipeline") ?? pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id ?? ""}
        onChange={e => set({ pipeline: e.target.value })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <select
        value={sp.get("owner") ?? "all"}
        onChange={e => set({ owner: e.target.value === "all" ? null : e.target.value })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <option value="all">Tutti i responsabili</option>
        {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>

      <select
        value={sp.get("status") ?? "all"}
        onChange={e => set({ status: e.target.value === "all" ? null : e.target.value })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "var(--fg-3)" }} />
        <input
          defaultValue={q}
          onChange={e => {
            clearTimeout(timerRef.current);
            const v = e.target.value;
            timerRef.current = setTimeout(() => set({ q: v || null }), 300);
          }}
          placeholder="Cerca opportunità o contatto…"
          className="w-full pl-8 pr-7 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
        {q && (
          <button onClick={() => set({ q: null })} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex rounded-[var(--r-md)] overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => set({ view: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
          style={{ backgroundColor: view === "kanban" ? "var(--fg)" : "var(--surface)", color: view === "kanban" ? "var(--surface)" : "var(--fg-2)", minHeight: "unset" }}
        >
          <KanbanSquare className="w-3.5 h-3.5" /> Kanban
        </button>
        <button
          onClick={() => set({ view: "list" })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
          style={{ backgroundColor: view === "list" ? "var(--fg)" : "var(--surface)", color: view === "list" ? "var(--surface)" : "var(--fg-2)", minHeight: "unset" }}
        >
          <ListIcon className="w-3.5 h-3.5" /> Lista
        </button>
      </div>
    </div>
  );
}
