"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { companyPath } from "@/lib/paths";
import { formatDate } from "@/lib/utils";
import { completeTaskAction, reopenTaskAction } from "@/app/actions/tasks";
import { TaskTypeIcon } from "./TaskIcons";
import type { TaskMemberOption, TaskRow } from "./types";

const PRIORITY_COLOR: Record<TaskRow["priority"], string> = {
  LOW: "var(--fg-3)",
  NORMAL: "var(--info)",
  HIGH: "var(--danger)",
};

function dueLabel(task: TaskRow): { text: string; overdue: boolean } | null {
  if (!task.dueAt) return null;
  const due = new Date(task.dueAt);
  const now = new Date();
  const days = differenceInCalendarDays(due, now);
  const overdue = task.status === "OPEN" && (days < 0 || (days === 0 && !task.allDay && due.getTime() < now.getTime()));
  const time = !task.allDay ? ` ${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}` : "";
  let text: string;
  if (days < -1) text = `${Math.abs(days)} giorni fa`;
  else if (days === -1) text = "Ieri";
  else if (days === 0) text = "Oggi";
  else if (days === 1) text = "Domani";
  else if (days <= 6) text = `Tra ${days} giorni`;
  else text = formatDate(due);
  return { text: `${text}${time}`, overdue };
}

/** Riga task per /tasks e per la tab Task della scheda contatto. */
export function TaskListItem({
  task, members, onEdit, showContact = true, onChanged,
}: {
  task: TaskRow;
  members: TaskMemberOption[];
  onEdit: (task: TaskRow) => void;
  showContact?: boolean;
  onChanged?: (task: TaskRow) => void;
}) {
  const slug = useCompanySlug();
  const [status, setStatus] = useState(task.status);
  const [pending, setPending] = useState(false);
  const done = status === "DONE";
  const due = dueLabel(task);
  const assignee = task.assigneeUserId ? members.find(m => m.userId === task.assigneeUserId)?.name : null;

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = done ? "OPEN" : "DONE";
    setStatus(next);
    const res = next === "DONE" ? await completeTaskAction(slug, task.id) : await reopenTaskAction(slug, task.id);
    setPending(false);
    if (!res.ok) { setStatus(done ? "DONE" : "OPEN"); return; }
    onChanged?.({ ...task, status: next });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(task)}
      onKeyDown={e => { if (e.key === "Enter") onEdit(task); }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] cursor-pointer hover:bg-subtle transition-colors"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={done ? "Riapri task" : "Completa task"}
        style={{ color: done ? "var(--ok)" : "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}
      >
        {done ? <CheckCircle2 className="w-[18px] h-[18px]" /> : <Circle className="w-[18px] h-[18px]" />}
      </button>

      <TaskTypeIcon type={task.type} className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />

      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: done ? "var(--fg-3)" : "var(--fg)", textDecoration: done ? "line-through" : "none" }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px]" style={{ color: "var(--fg-3)" }}>
          {showContact && task.contact && (
            <Link
              href={companyPath(slug, `/contacts/${task.contact.id}`)}
              onClick={e => e.stopPropagation()}
              className="hover:underline"
              style={{ color: "var(--fg-2)" }}
            >
              {task.contact.name}
            </Link>
          )}
          {task.opportunity && <span>{task.opportunity.name}</span>}
          {assignee && <span>{assignee}</span>}
        </div>
      </div>

      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} title={task.priority} />

      {due && (
        <span className="text-[11px] shrink-0 tabular-nums" style={{ color: due.overdue ? "var(--danger)" : "var(--fg-3)" }}>
          {due.text}
        </span>
      )}

      <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />
    </div>
  );
}
