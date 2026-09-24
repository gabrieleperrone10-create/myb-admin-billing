import "server-only";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import type { Task, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { basePrisma, type CompanyDb } from "@/lib/db";
import { logActivity } from "./activity";
import { contactDisplayName } from "./contacts";

/**
 * API condivisa dei task/follow-up (agente Task).
 *
 * `db` e' sempre un client gia' filtrato per azienda (requireCompany() /
 * companyDb(companyId)); `companyId` serve solo per stampare le create (vedi
 * lib/db.ts) e per le verifiche di appartenenza che passano da CompanyMember
 * (non e' un TENANT_MODEL: si interroga col client base, come in
 * lib/crm/members.ts).
 *
 * Ogni create/complete registra l'attivita' nella cronologia SOLO se il task
 * ha un contatto collegato (Activity.contactId e' NOT NULL): un task senza
 * contatto (promemoria interno) non produce voci di cronologia.
 */

// ─── Fuso azienda: "oggi"/"in ritardo" ─────────────────────────────────────

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inizio della giornata (00:00 locale) nel fuso indicato, come istante UTC. */
export function startOfDayInTz(date: Date, tz: string, offsetDays = 0): Date {
  const dateStr = formatInTimeZone(date, tz, "yyyy-MM-dd");
  const target = offsetDays === 0 ? dateStr : addDaysStr(dateStr, offsetDays);
  return fromZonedTime(`${target}T00:00:00`, tz);
}

// ─── Verifiche di appartenenza ──────────────────────────────────────────────

async function assertAssigneeBelongs(companyId: string, assigneeUserId: string | null | undefined) {
  if (!assigneeUserId) return;
  const member = await basePrisma.companyMember.findFirst({ where: { companyId, clerkUserId: assigneeUserId } });
  if (!member) throw new Error("L'assegnatario selezionato non appartiene a questa azienda");
}

async function assertContactBelongs(db: CompanyDb, contactId: string | null | undefined) {
  if (!contactId) return null;
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, ownerUserId: true },
  });
  if (!contact) throw new Error("Contatto non trovato");
  return contact;
}

async function assertOpportunityBelongs(db: CompanyDb, opportunityId: string | null | undefined, contactId: string | null | undefined) {
  if (!opportunityId) return null;
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true, contactId: true, name: true } });
  if (!opp) throw new Error("Opportunità non trovata");
  if (contactId && opp.contactId !== contactId) throw new Error("L'opportunità non appartiene al contatto selezionato");
  return opp;
}

// ─── Creazione / modifica ───────────────────────────────────────────────────

export type TaskInput = {
  title: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  dueAt?: Date | null;
  allDay?: boolean;
  assigneeUserId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
};

export async function createTask(
  db: CompanyDb,
  companyId: string,
  input: TaskInput,
  opts: { actorUserId?: string | null } = {},
): Promise<Task> {
  const title = input.title.trim();
  if (!title) throw new Error("Il titolo è obbligatorio");

  await assertAssigneeBelongs(companyId, input.assigneeUserId);
  await assertContactBelongs(db, input.contactId);
  await assertOpportunityBelongs(db, input.opportunityId, input.contactId);

  const task = await db.task.create({
    data: {
      companyId,
      title,
      description: input.description?.trim() || null,
      type: input.type ?? "TODO",
      priority: input.priority ?? "NORMAL",
      dueAt: input.dueAt ?? null,
      allDay: input.allDay ?? false,
      assigneeUserId: input.assigneeUserId ?? null,
      createdByUserId: opts.actorUserId ?? null,
      contactId: input.contactId ?? null,
      opportunityId: input.opportunityId ?? null,
    },
  });

  if (task.contactId) {
    await logActivity(db, companyId, {
      contactId: task.contactId,
      opportunityId: task.opportunityId ?? undefined,
      type: "TASK_CREATED",
      data: {
        taskId: task.id,
        title: task.title,
        dueAt: task.dueAt ? task.dueAt.toISOString() : undefined,
        assigneeUserId: task.assigneeUserId ?? undefined,
      },
      actorUserId: opts.actorUserId,
    });
  }

  return task;
}

export type TaskUpdateInput = Partial<TaskInput>;

export async function updateTask(
  db: CompanyDb,
  companyId: string,
  taskId: string,
  input: TaskUpdateInput,
  opts: { actorUserId?: string | null } = {},
): Promise<Task> {
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task non trovato");

  const nextContactId = input.contactId !== undefined ? input.contactId : existing.contactId;
  const nextOpportunityId = input.opportunityId !== undefined ? input.opportunityId : existing.opportunityId;

  if (input.assigneeUserId !== undefined) await assertAssigneeBelongs(companyId, input.assigneeUserId);
  if (input.contactId !== undefined) await assertContactBelongs(db, input.contactId);
  if (input.opportunityId !== undefined || input.contactId !== undefined) {
    await assertOpportunityBelongs(db, nextOpportunityId, nextContactId);
  }

  if (input.title !== undefined && !input.title.trim()) throw new Error("Il titolo è obbligatorio");

  const updated = await db.task.update({
    where: { id: taskId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}),
    },
  });

  void opts; // uniformita' con le altre funzioni del modulo; nessuna Activity per "task modificato" (nessun ActivityType generico, come per updateOpportunity)
  return updated;
}

// ─── Completamento / riapertura / eliminazione ─────────────────────────────

export async function completeTask(
  db: CompanyDb,
  companyId: string,
  taskId: string,
  opts: { actorUserId?: string | null } = {},
): Promise<Task> {
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task non trovato");
  if (existing.status === "DONE") return existing;

  const updated = await db.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date(), completedByUserId: opts.actorUserId ?? null },
  });

  if (updated.contactId) {
    await logActivity(db, companyId, {
      contactId: updated.contactId,
      opportunityId: updated.opportunityId ?? undefined,
      type: "TASK_COMPLETED",
      data: { taskId: updated.id, title: updated.title },
      actorUserId: opts.actorUserId,
    });
  }

  return updated;
}

export async function reopenTask(
  db: CompanyDb,
  companyId: string,
  taskId: string,
): Promise<Task> {
  void companyId;
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task non trovato");
  if (existing.status === "OPEN") return existing;

  return db.task.update({
    where: { id: taskId },
    data: { status: "OPEN", completedAt: null, completedByUserId: null },
  });
}

export async function deleteTask(db: CompanyDb, companyId: string, taskId: string): Promise<void> {
  void companyId;
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error("Task non trovato");
  await db.task.delete({ where: { id: taskId } });
}

// ─── Follow-up rapido ───────────────────────────────────────────────────────

/**
 * "Follow-up rapido": crea in un colpo solo un task "Follow-up <contatto>" di
 * tipo CALL per domani alle 10:00 (fuso azienda), assegnato al responsabile
 * del contatto o, in mancanza, a chi lo crea.
 */
export async function quickFollowUp(
  db: CompanyDb,
  companyId: string,
  contactId: string,
  tz: string,
  opts: { actorUserId?: string | null } = {},
): Promise<Task> {
  const contact = await assertContactBelongs(db, contactId);
  if (!contact) throw new Error("Contatto non trovato");

  const tomorrow10 = new Date(startOfDayInTz(new Date(), tz, 1).getTime() + 10 * 60 * 60_000);
  const assigneeUserId = contact.ownerUserId ?? opts.actorUserId ?? null;

  return createTask(db, companyId, {
    title: `Follow-up ${contactDisplayName(contact)}`,
    type: "CALL",
    priority: "NORMAL",
    dueAt: tomorrow10,
    allDay: false,
    assigneeUserId,
    contactId,
  }, opts);
}

// ─── Lista / filtri ─────────────────────────────────────────────────────────

export type TaskListFilters = {
  assigneeUserId?: string | null; // null/undefined = tutti
  status?: TaskStatus;
  type?: TaskType[];
  priority?: TaskPriority[];
  contactId?: string;
  opportunityId?: string;
  take?: number;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  allDay: boolean;
  assigneeUserId: string | null;
  completedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
};

function toTaskRow(t: Task & { contact: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; companyName: string | null } | null; opportunity: { id: string; name: string } | null }): TaskRow {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    allDay: t.allDay,
    assigneeUserId: t.assigneeUserId,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    contact: t.contact ? { id: t.contact.id, name: contactDisplayName(t.contact) } : null,
    opportunity: t.opportunity ? { id: t.opportunity.id, name: t.opportunity.name } : null,
  };
}

export async function listTasks(db: CompanyDb, filters: TaskListFilters = {}): Promise<TaskRow[]> {
  const rows = await db.task.findMany({
    where: {
      ...(filters.assigneeUserId ? { assigneeUserId: filters.assigneeUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type && filters.type.length ? { type: { in: filters.type } } : {}),
      ...(filters.priority && filters.priority.length ? { priority: { in: filters.priority } } : {}),
      ...(filters.contactId ? { contactId: filters.contactId } : {}),
      ...(filters.opportunityId ? { opportunityId: filters.opportunityId } : {}),
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
      opportunity: { select: { id: true, name: true } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    ...(filters.take ? { take: filters.take } : {}),
  });
  return rows.map(toTaskRow);
}

/** Raggruppa i task aperti nelle sezioni della pagina /tasks, nel fuso azienda. */
export type TaskBuckets = {
  overdue: TaskRow[];
  today: TaskRow[];
  next7: TaskRow[];
  later: TaskRow[];
  noDueDate: TaskRow[];
};

export function bucketOpenTasks(tasks: TaskRow[], tz: string, now = new Date()): TaskBuckets {
  const startToday = startOfDayInTz(now, tz).getTime();
  const startTomorrow = startOfDayInTz(now, tz, 1).getTime();
  const startPlus8 = startOfDayInTz(now, tz, 8).getTime();

  const buckets: TaskBuckets = { overdue: [], today: [], next7: [], later: [], noDueDate: [] };
  for (const t of tasks) {
    if (!t.dueAt) { buckets.noDueDate.push(t); continue; }
    const ms = new Date(t.dueAt).getTime();
    if (ms < startToday) buckets.overdue.push(t);
    else if (ms < startTomorrow) buckets.today.push(t);
    else if (ms < startPlus8) buckets.next7.push(t);
    else buckets.later.push(t);
  }
  return buckets;
}

/** Badge sidebar (agente owner: integrazione lato mio). In ritardo + in scadenza oggi. */
export async function countMyDueTasks(db: CompanyDb, userId: string, timezone: string): Promise<number> {
  const startTomorrow = startOfDayInTz(new Date(), timezone, 1);
  return db.task.count({
    where: { assigneeUserId: userId, status: "OPEN", dueAt: { lt: startTomorrow } },
  });
}
