"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { TaskMemberOption } from "./types";
import { TASK_PRIORITY_LABEL, TASK_TYPE_LABEL } from "./types";
import type { TaskPriority, TaskType } from "@prisma/client";

const TYPES: TaskType[] = ["TODO", "CALL", "EMAIL", "WHATSAPP", "MEETING"];
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH"];

/** Filtri della pagina /tasks: assegnatario, tipo, priorità — sincronizzati con l'URL. */
export function TaskFilters({ members }: { members: TaskMemberOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const assignee = sp.get("assignee") ?? "mine";
  const type = sp.get("type") ?? "";
  const priority = sp.get("priority") ?? "";

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-3">
      <select
        value={assignee}
        onChange={e => set({ assignee: e.target.value === "mine" ? null : e.target.value })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <option value="mine">Miei</option>
        <option value="all">Tutti</option>
        {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>

      <select
        value={type}
        onChange={e => set({ type: e.target.value || null })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <option value="">Tutti i tipi</option>
        {TYPES.map(t => <option key={t} value={t}>{TASK_TYPE_LABEL[t]}</option>)}
      </select>

      <select
        value={priority}
        onChange={e => set({ priority: e.target.value || null })}
        className="px-3 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <option value="">Tutte le priorità</option>
        {PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
      </select>
    </div>
  );
}
