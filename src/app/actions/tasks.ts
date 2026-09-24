"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { contactDisplayName } from "@/lib/crm/contacts";
import { startOfDayInTz, createTask, updateTask, completeTask, reopenTask, deleteTask, quickFollowUp, listTasks, type TaskRow } from "@/lib/crm/tasks";
import { getEffectivePermissions, canEdit } from "@/lib/permissions";

/**
 * Server action dei task/follow-up (agente Task). Stessa convenzione delle
 * altre action del CRM: `{ ok: true, data }` / `{ ok: false, error }`, mai
 * lanciate, cosi' i form client possono mostrare l'errore inline.
 *
 * Il form invia sempre data + ora separate ("dueDate"/"dueTime", locali al
 * fuso dell'azienda) invece di un ISO gia' calcolato: la conversione al fuso
 * dell'azienda (Company.timezone) avviene solo qui, lato server, cosi' i
 * componenti client (compresi quelli che non ricevono l'azienda come prop,
 * es. ContactHeaderActions) non devono mai conoscere il fuso.
 */

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function revalidateTasks(slug: string) {
  revalidatePath(`/${slug}/tasks`);
}
function revalidateContact(slug: string, contactId: string | null | undefined) {
  if (contactId) revalidatePath(`/${slug}/contacts/${contactId}`);
}
function revalidateOpportunities(slug: string) {
  revalidatePath(`/${slug}/opportunities`);
}

async function canEditTasks(ctx: CompanyContext) {
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);
  return canEdit(perms, "TASKS");
}

function resolveDue(dueDate: string | null | undefined, dueTime: string | null | undefined, tz: string): { dueAt: Date | null; allDay: boolean } {
  if (!dueDate) return { dueAt: null, allDay: false };
  if (dueTime) return { dueAt: fromZonedTime(`${dueDate}T${dueTime}:00`, tz), allDay: false };
  return { dueAt: fromZonedTime(`${dueDate}T00:00:00`, tz), allDay: true };
}

function toRow(task: {
  id: string; title: string; description: string | null; type: TaskRow["type"]; priority: TaskRow["priority"];
  status: TaskRow["status"]; dueAt: Date | null; allDay: boolean; assigneeUserId: string | null;
  completedAt: Date | null; createdAt: Date; contactId: string | null; opportunityId: string | null;
}, contact: { id: string; name: string } | null, opportunity: { id: string; name: string } | null): TaskRow {
  return {
    id: task.id, title: task.title, description: task.description, type: task.type, priority: task.priority,
    status: task.status, dueAt: task.dueAt ? task.dueAt.toISOString() : null, allDay: task.allDay,
    assigneeUserId: task.assigneeUserId, completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(), contact, opportunity,
  };
}

// ─── Creazione / modifica ───────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  type: z.enum(["TODO", "CALL", "EMAIL", "WHATSAPP", "MEETING"]).default("TODO"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  dueDate: z.string().trim().regex(DATE_RE, "Data non valida").optional().nullable(),
  dueTime: z.string().trim().regex(TIME_RE, "Ora non valida").optional().nullable(),
  assigneeUserId: z.string().trim().optional().nullable(),
  contactId: z.string().trim().optional().nullable(),
  opportunityId: z.string().trim().optional().nullable(),
});

export type TaskFormInput = z.input<typeof taskInputSchema>;

export const createTaskAction = companyAction(async (ctx, rawInput: TaskFormInput): Promise<ActionResult<TaskRow>> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di creare task");
  const parsed = taskInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dati non validi");
  const input = parsed.data;
  const { dueAt, allDay } = resolveDue(input.dueDate, input.dueTime, ctx.company.timezone);

  try {
    const task = await createTask(ctx.db, ctx.companyId, {
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      dueAt,
      allDay,
      assigneeUserId: input.assigneeUserId || null,
      contactId: input.contactId || null,
      opportunityId: input.opportunityId || null,
    }, { actorUserId: ctx.userId });

    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, task.contactId);
    if (task.opportunityId) revalidateOpportunities(ctx.slug);

    const [contact, opportunity] = await Promise.all([
      task.contactId
        ? ctx.db.contact.findUnique({ where: { id: task.contactId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } })
        : Promise.resolve(null),
      task.opportunityId
        ? ctx.db.opportunity.findUnique({ where: { id: task.opportunityId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);

    return ok(toRow(
      task,
      contact ? { id: contact.id, name: contactDisplayName(contact) } : null,
      opportunity,
    ));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione del task");
  }
});

export const updateTaskAction = companyAction(async (ctx, taskId: string, rawInput: TaskFormInput): Promise<ActionResult<TaskRow>> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di modificare i task");
  const parsed = taskInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dati non validi");
  const input = parsed.data;
  const { dueAt, allDay } = resolveDue(input.dueDate, input.dueTime, ctx.company.timezone);

  try {
    const before = await ctx.db.task.findUnique({ where: { id: taskId }, select: { contactId: true, opportunityId: true } });
    if (!before) return fail("Task non trovato");

    const task = await updateTask(ctx.db, ctx.companyId, taskId, {
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      priority: input.priority,
      dueAt,
      allDay,
      assigneeUserId: input.assigneeUserId || null,
      contactId: input.contactId || null,
      opportunityId: input.opportunityId || null,
    }, { actorUserId: ctx.userId });

    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, before.contactId);
    revalidateContact(ctx.slug, task.contactId);
    if (before.opportunityId || task.opportunityId) revalidateOpportunities(ctx.slug);

    const [contact, opportunity] = await Promise.all([
      task.contactId
        ? ctx.db.contact.findUnique({ where: { id: task.contactId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } })
        : Promise.resolve(null),
      task.opportunityId
        ? ctx.db.opportunity.findUnique({ where: { id: task.opportunityId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);

    return ok(toRow(
      task,
      contact ? { id: contact.id, name: contactDisplayName(contact) } : null,
      opportunity,
    ));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nell'aggiornamento del task");
  }
});

// ─── Completamento / riapertura / eliminazione ─────────────────────────────

export const completeTaskAction = companyAction(async (ctx, taskId: string): Promise<ActionResult> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di completare i task");
  try {
    const task = await completeTask(ctx.db, ctx.companyId, taskId, { actorUserId: ctx.userId });
    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, task.contactId);
    if (task.opportunityId) revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nel completamento del task");
  }
});

export const reopenTaskAction = companyAction(async (ctx, taskId: string): Promise<ActionResult> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di riaprire i task");
  try {
    const task = await reopenTask(ctx.db, ctx.companyId, taskId);
    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, task.contactId);
    if (task.opportunityId) revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella riapertura del task");
  }
});

export const deleteTaskAction = companyAction(async (ctx, taskId: string): Promise<ActionResult> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di eliminare i task");
  try {
    const existing = await ctx.db.task.findUnique({ where: { id: taskId }, select: { contactId: true, opportunityId: true } });
    await deleteTask(ctx.db, ctx.companyId, taskId);
    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, existing?.contactId);
    if (existing?.opportunityId) revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nell'eliminazione del task");
  }
});

// ─── Follow-up rapido (scheda contatto + kanban) ───────────────────────────

export const quickFollowUpAction = companyAction(async (ctx, contactId: string): Promise<ActionResult> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di creare task");
  try {
    await quickFollowUp(ctx.db, ctx.companyId, contactId, ctx.company.timezone, { actorUserId: ctx.userId });
    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, contactId);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione del follow-up");
  }
});

/** Follow-up rapido dal kanban dopo uno spostamento di fase: Domani / 3 giorni / 1 settimana. */
export const createOpportunityFollowUpAction = companyAction(async (ctx, opportunityId: string, offsetDays: 1 | 3 | 7): Promise<ActionResult> => {
  if (!(await canEditTasks(ctx))) return fail("Non hai il permesso di creare task");
  try {
    const opp = await ctx.db.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true, name: true, contactId: true, ownerUserId: true } });
    if (!opp) return fail("Opportunità non trovata");

    const dueAt = new Date(startOfDayInTz(new Date(), ctx.company.timezone, offsetDays).getTime() + 10 * 60 * 60_000);
    await createTask(ctx.db, ctx.companyId, {
      title: `Follow-up ${opp.name}`,
      type: "CALL",
      priority: "NORMAL",
      dueAt,
      allDay: false,
      assigneeUserId: opp.ownerUserId ?? ctx.userId,
      contactId: opp.contactId,
      opportunityId: opp.id,
    }, { actorUserId: ctx.userId });

    revalidateTasks(ctx.slug);
    revalidateContact(ctx.slug, opp.contactId);
    revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione del follow-up");
  }
});

// ─── Ricerca contatto / opportunità (dialog task) ──────────────────────────

export type PickedTaskContact = { id: string; name: string; email: string | null; companyName: string | null };

export const searchContactsForTask = companyAction(async (ctx, q: string): Promise<PickedTaskContact[]> => {
  const query = q.trim();
  const where = query
    ? {
        OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { companyName: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const rows = await ctx.db.contact.findMany({
    where,
    take: 10,
    orderBy: { lastActivityAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
  });
  return rows.map(c => ({ id: c.id, name: contactDisplayName(c), email: c.email, companyName: c.companyName }));
});

export const getContactBrief = companyAction(async (ctx, contactId: string): Promise<PickedTaskContact | null> => {
  const c = await ctx.db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
  });
  if (!c) return null;
  return { id: c.id, name: contactDisplayName(c), email: c.email, companyName: c.companyName };
});

export type TaskOpportunityOption = { id: string; name: string };

export const listContactOpportunities = companyAction(async (ctx, contactId: string): Promise<TaskOpportunityOption[]> => {
  if (!contactId) return [];
  return ctx.db.opportunity.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
});

// ─── Task di un'opportunità (drawer opportunità) ───────────────────────────

export const listOpportunityTasksAction = companyAction(async (ctx, opportunityId: string): Promise<TaskRow[]> => {
  return listTasks(ctx.db, { opportunityId });
});
