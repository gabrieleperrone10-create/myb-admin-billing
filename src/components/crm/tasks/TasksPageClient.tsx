"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TaskFormDialog } from "./TaskFormDialog";
import { TaskListItem } from "./TaskListItem";
import type { TaskMemberOption, TaskRow } from "./types";
// "server-only" e' solo runtime: il tipo si importa ed erasa alla compilazione.
import type { TaskBuckets } from "@/lib/crm/tasks";

const SECTIONS: { key: keyof TaskBuckets; label: string }[] = [
  { key: "overdue", label: "In ritardo" },
  { key: "today", label: "Oggi" },
  { key: "next7", label: "Prossimi 7 giorni" },
  { key: "later", label: "Più avanti" },
  { key: "noDueDate", label: "Senza scadenza" },
];

export function TasksPageClient({
  members, currentUserId, companyTimezone, tab, buckets, completed,
}: {
  members: TaskMemberOption[];
  currentUserId: string;
  companyTimezone: string;
  tab: "open" | "completed";
  buckets: TaskBuckets | null;
  completed: TaskRow[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  function tabHref(next: "open" | "completed") {
    const params = new URLSearchParams(sp.toString());
    if (next === "open") params.delete("tab");
    else params.set("tab", "completed");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function refresh() {
    router.refresh();
  }

  const totalOpen = buckets ? SECTIONS.reduce((n, s) => n + buckets[s.key].length, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Le mie attività</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Task e follow-up del team</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuovo task
        </button>
      </div>

      <nav className="flex gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link
          href={tabHref("open")}
          className="px-3 py-2 text-[13px] whitespace-nowrap -mb-px"
          style={{
            color: tab === "open" ? "var(--fg)" : "var(--fg-3)",
            borderBottom: tab === "open" ? "2px solid var(--fg)" : "2px solid transparent",
            fontWeight: tab === "open" ? 600 : 400,
          }}
        >
          Aperti{buckets ? ` (${totalOpen})` : ""}
        </Link>
        <Link
          href={tabHref("completed")}
          className="px-3 py-2 text-[13px] whitespace-nowrap -mb-px"
          style={{
            color: tab === "completed" ? "var(--fg)" : "var(--fg-3)",
            borderBottom: tab === "completed" ? "2px solid var(--fg)" : "2px solid transparent",
            fontWeight: tab === "completed" ? 600 : 400,
          }}
        >
          Completati
        </Link>
      </nav>

      {tab === "open" && buckets && (
        totalOpen === 0 ? (
          <p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>Nessun task da mostrare.</p>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map(({ key, label }) => {
              const items = buckets[key];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <p className="font-mono text-[10px] uppercase tracking-table-head mb-2" style={{ color: key === "overdue" ? "var(--danger)" : "var(--fg-3)" }}>
                    {label} ({items.length})
                  </p>
                  <div className="space-y-1.5">
                    {items.map(t => (
                      <TaskListItem key={t.id} task={t} members={members} onEdit={setEditing} onChanged={refresh} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === "completed" && completed && (
        completed.length === 0 ? (
          <p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>Nessun task completato.</p>
        ) : (
          <div className="space-y-1.5">
            {completed.map(t => (
              <TaskListItem key={t.id} task={t} members={members} onEdit={setEditing} onChanged={refresh} />
            ))}
          </div>
        )
      )}

      <TaskFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        currentUserId={currentUserId}
        companyTimezone={companyTimezone}
        onSaved={() => { setCreateOpen(false); refresh(); }}
      />
      <TaskFormDialog
        key={editing?.id ?? "edit"}
        open={!!editing}
        onClose={() => setEditing(null)}
        members={members}
        currentUserId={currentUserId}
        companyTimezone={companyTimezone}
        task={editing}
        onSaved={() => { setEditing(null); refresh(); }}
      />
    </div>
  );
}
