export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { canView, getEffectivePermissions } from "@/lib/permissions";
import { listCompanyMembers } from "@/lib/crm/members";
import { listTasks, bucketOpenTasks } from "@/lib/crm/tasks";
import { TaskFilters } from "@/components/crm/tasks/TaskFilters";
import { TasksPageClient } from "@/components/crm/tasks/TasksPageClient";
import type { TaskPriority, TaskType } from "@prisma/client";

const TYPES: TaskType[] = ["TODO", "CALL", "EMAIL", "WHATSAPP", "MEETING"];
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH"];

/**
 * Pagina "Le mie attività": task del team con sezioni per scadenza (In
 * ritardo / Oggi / Prossimi 7 giorni / Più avanti / Senza scadenza) e tab
 * Completati. Filtro assegnatario di default su "Miei" (ctx.userId).
 */
export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ assignee?: string; type?: string; priority?: string; tab?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireCompany(slug);
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);

  if (!canView(perms, "TASKS")) {
    return (
      <p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>
        Non hai i permessi per vedere le attività.
      </p>
    );
  }

  const members = await listCompanyMembers(ctx.companyId);
  const memberOptions = members.map(m => ({ userId: m.userId, name: m.name }));

  const assigneeParam = sp.assignee ?? "mine";
  const assigneeUserId = assigneeParam === "all" ? null : assigneeParam === "mine" ? ctx.userId : assigneeParam;

  const type = sp.type && TYPES.includes(sp.type as TaskType) ? [sp.type as TaskType] : undefined;
  const priority = sp.priority && PRIORITIES.includes(sp.priority as TaskPriority) ? [sp.priority as TaskPriority] : undefined;

  const tab = sp.tab === "completed" ? "completed" : "open";

  const [openTasks, completedTasks] = await Promise.all([
    tab === "open"
      ? listTasks(ctx.db, { assigneeUserId, status: "OPEN", type, priority })
      : Promise.resolve(null),
    tab === "completed"
      ? listTasks(ctx.db, { assigneeUserId, status: "DONE", type, priority, take: 100 })
      : Promise.resolve(null),
  ]);

  const buckets = openTasks ? bucketOpenTasks(openTasks, ctx.company.timezone) : null;
  const completed = completedTasks
    ? [...completedTasks].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    : null;

  return (
    <Suspense fallback={null}>
      <div className="space-y-4">
        <TaskFilters members={memberOptions} />

        <TasksPageClient
          members={memberOptions}
          currentUserId={ctx.userId}
          companyTimezone={ctx.company.timezone}
          tab={tab}
          buckets={buckets}
          completed={completed}
        />
      </div>
    </Suspense>
  );
}
