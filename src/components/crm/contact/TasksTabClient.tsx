"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { quickFollowUpAction } from "@/app/actions/tasks";
import { TaskFormDialog } from "@/components/crm/tasks/TaskFormDialog";
import { TaskListItem } from "@/components/crm/tasks/TaskListItem";
import type { PickedTaskContact } from "@/app/actions/tasks";
import type { TaskMemberOption, TaskRow } from "@/components/crm/tasks/types";

/** Tab Task della scheda contatto (agente Task): task aperti + completati recenti + follow-up rapido. */
export function TasksTabClient({
  contact, openTasks, completedTasks, members, currentUserId, companyTimezone,
}: {
  contact: PickedTaskContact;
  openTasks: TaskRow[];
  completedTasks: TaskRow[];
  members: TaskMemberOption[];
  currentUserId: string;
  companyTimezone: string;
}) {
  const router = useRouter();
  const slug = useCompanySlug();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function refresh() {
    router.refresh();
  }

  function doQuickFollowUp() {
    setError("");
    startTransition(async () => {
      const res = await quickFollowUpAction(slug, contact.id);
      if (!res.ok) { setError(res.error); return; }
      refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuovo task
        </button>
        <button
          onClick={doQuickFollowUp}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px]"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
        >
          <Zap className="w-3.5 h-3.5" /> {pending ? "Creazione…" : "Follow-up rapido"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-[var(--r-md)] text-[12px]" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>
      )}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-table-head mb-2" style={{ color: "var(--fg-3)" }}>
          Aperti ({openTasks.length})
        </p>
        {openTasks.length === 0 ? (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessun task aperto per questo contatto</p>
        ) : (
          <div className="space-y-1.5">
            {openTasks.map(t => (
              <TaskListItem key={t.id} task={t} members={members} onEdit={setEditing} showContact={false} onChanged={refresh} />
            ))}
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-table-head mb-2" style={{ color: "var(--fg-3)" }}>
            Completati di recente
          </p>
          <div className="space-y-1.5">
            {completedTasks.map(t => (
              <TaskListItem key={t.id} task={t} members={members} onEdit={setEditing} showContact={false} onChanged={refresh} />
            ))}
          </div>
        </div>
      )}

      <TaskFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        currentUserId={currentUserId}
        companyTimezone={companyTimezone}
        defaultContact={contact}
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
