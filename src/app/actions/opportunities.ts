"use server";

import { plainTextToNoteHtml } from "@/lib/crm/sanitize";
import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";
import { createOpportunity, moveOpportunity, markWon, markLost, updateOpportunity } from "@/lib/crm/opportunities";
import { upsertContact, ensureBillingClient, contactDisplayName } from "@/lib/crm/contacts";
import { logActivity } from "@/lib/crm/activity";
import { validateCustomFields } from "@/lib/crm/customFields";
import type { CompanyDb, Prisma } from "@/lib/db";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function revalidateOpportunities(slug: string) {
  revalidatePath(`/${slug}/opportunities`);
}

// ─── Ricerca / creazione rapida contatto (per il drawer opportunità) ───────

export const searchContactsForOpportunity = companyAction(async (ctx, q: string) => {
  const query = q.trim();
  if (!query) {
    const recent = await ctx.db.contact.findMany({
      orderBy: { lastActivityAt: "desc" },
      take: 8,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
    });
    return recent.map(c => ({ id: c.id, name: contactDisplayName(c), email: c.email, companyName: c.companyName }));
  }
  const results = await ctx.db.contact.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 8,
    orderBy: { lastActivityAt: "desc" },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
  });
  return results.map(c => ({ id: c.id, name: contactDisplayName(c), email: c.email, companyName: c.companyName }));
});

export const quickCreateContact = companyAction(async (
  ctx,
  input: { name: string; email?: string; phone?: string },
) => {
  const name = input.name.trim();
  if (!name) return fail("Il nome è obbligatorio");
  if (!input.email?.trim() && !input.phone?.trim()) return fail("Serve almeno email o telefono");

  const [firstName, ...rest] = name.split(/\s+/);
  try {
    const { contact } = await upsertContact(ctx.db, ctx.companyId, {
      firstName,
      lastName: rest.join(" ") || null,
      email: input.email || null,
      phone: input.phone || null,
      source: "manual",
    }, { actorUserId: ctx.userId });
    return ok({ id: contact.id, name: contactDisplayName(contact), email: contact.email, companyName: contact.companyName });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione del contatto");
  }
});

// ─── Creazione / modifica opportunità ──────────────────────────────────────

export type OpportunityFormInput = {
  contactId: string;
  pipelineId: string;
  stageId: string;
  name?: string;
  value?: number;
  ownerUserId?: string | null;
  productId?: string | null;
  expectedCloseDate?: string | null; // ISO date
  customFields?: Record<string, unknown>;
  note?: string;
};

export const createOpportunityAction = companyAction(async (ctx, input: OpportunityFormInput) => {
  if (!input.contactId) return fail("Seleziona un contatto");
  if (!input.pipelineId || !input.stageId) return fail("Seleziona pipeline e fase");

  let customFieldValues: Record<string, unknown> | undefined;
  if (input.customFields && Object.keys(input.customFields).length) {
    const defs = await ctx.db.customFieldDef.findMany({ where: { entity: "OPPORTUNITY" } });
    const res = validateCustomFields(defs, input.customFields);
    if (!res.ok) return fail(Object.values(res.errors)[0] ?? "Campi personalizzati non validi");
    customFieldValues = res.values;
  }

  try {
    const opp = await createOpportunity(ctx.db, ctx.companyId, {
      contactId: input.contactId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      name: input.name || null,
      value: input.value ?? 0,
      ownerUserId: input.ownerUserId ?? null,
      productId: input.productId ?? null,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
    }, { actorUserId: ctx.userId });

    if (customFieldValues) {
      await ctx.db.opportunity.update({ where: { id: opp.id }, data: { customFields: customFieldValues as Prisma.InputJsonValue } });
    }

    if (input.note?.trim()) {
      await addOpportunityNoteInternal(ctx.db, ctx.companyId, opp.id, input.contactId, input.note.trim(), ctx.userId);
    }

    revalidateOpportunities(ctx.slug);
    return ok({ id: opp.id });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione dell'opportunità");
  }
});

export const updateOpportunityAction = companyAction(async (ctx, id: string, input: OpportunityFormInput) => {
  if (!input.contactId) return fail("Seleziona un contatto");
  if (!input.pipelineId || !input.stageId) return fail("Seleziona pipeline e fase");

  let customFieldValues: Record<string, unknown> | undefined;
  if (input.customFields) {
    const defs = await ctx.db.customFieldDef.findMany({ where: { entity: "OPPORTUNITY" } });
    const res = validateCustomFields(defs, input.customFields);
    if (!res.ok) return fail(Object.values(res.errors)[0] ?? "Campi personalizzati non validi");
    customFieldValues = res.values;
  }

  try {
    await updateOpportunity(ctx.db, ctx.companyId, id, {
      name: input.name,
      contactId: input.contactId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      value: input.value,
      ownerUserId: input.ownerUserId ?? null,
      productId: input.productId ?? null,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
      customFields: customFieldValues,
    }, { actorUserId: ctx.userId });

    if (input.note?.trim()) {
      await addOpportunityNoteInternal(ctx.db, ctx.companyId, id, input.contactId, input.note.trim(), ctx.userId);
    }

    revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nell'aggiornamento dell'opportunità");
  }
});

// ─── Kanban: spostamento drag & drop ───────────────────────────────────────

export const moveOpportunityAction = companyAction(async (
  ctx,
  id: string,
  input: { stageId: string; beforeId?: string | null; afterId?: string | null; lostReason?: string | null },
) => {
  try {
    const updated = await moveOpportunity(ctx.db, ctx.companyId, id, input, { actorUserId: ctx.userId });
    revalidateOpportunities(ctx.slug);
    return ok({ status: updated.status });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nello spostamento dell'opportunità");
  }
});

export const markOpportunityWonAction = companyAction(async (ctx, id: string) => {
  try {
    await markWon(ctx.db, ctx.companyId, id, { actorUserId: ctx.userId });
    revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nel segnare l'opportunità come vinta");
  }
});

export const markOpportunityLostAction = companyAction(async (ctx, id: string, reason: string | null) => {
  try {
    await markLost(ctx.db, ctx.companyId, id, reason, { actorUserId: ctx.userId });
    revalidateOpportunities(ctx.slug);
    return ok(undefined);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nel segnare l'opportunità come persa");
  }
});

// ─── Vinta → cliente di fatturazione + contratto ──────────────────────────

export const convertOpportunityToClientAction = companyAction(async (ctx, opportunityId: string) => {
  const opp = await ctx.db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, contactId: true, value: true, productId: true },
  });
  if (!opp) return fail("Opportunità non trovata");

  try {
    const client = await ensureBillingClient(ctx.db, ctx.companyId, opp.contactId, ctx.userId);
    revalidateOpportunities(ctx.slug);
    return ok({
      clientId: client.id,
      productId: opp.productId,
      amount: opp.value,
      opportunityId: opp.id,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Errore nella creazione del cliente di fatturazione");
  }
});

// ─── Note rapide ────────────────────────────────────────────────────────────

async function addOpportunityNoteInternal(
  db: CompanyDb,
  companyId: string,
  opportunityId: string,
  contactId: string,
  body: string,
  actorUserId: string,
) {
  // Il testo arriva da una textarea: si salva come HTML con escape, mai grezzo
  // (NoteCard lo rende con dangerouslySetInnerHTML).
  const html = plainTextToNoteHtml(body);
  const note = await db.note.create({
    data: { companyId, contactId, opportunityId, authorUserId: actorUserId, body: html },
  });
  await logActivity(db, companyId, {
    contactId,
    opportunityId,
    type: "NOTE_ADDED",
    data: { noteId: note.id, preview: body.slice(0, 140) },
    actorUserId,
  });
  return note;
}

export const addOpportunityNoteAction = companyAction(async (ctx, opportunityId: string, body: string) => {
  const trimmed = body.trim();
  if (!trimmed) return fail("La nota è vuota");
  const opp = await ctx.db.opportunity.findUnique({ where: { id: opportunityId }, select: { contactId: true } });
  if (!opp) return fail("Opportunità non trovata");

  await addOpportunityNoteInternal(ctx.db, ctx.companyId, opportunityId, opp.contactId, trimmed, ctx.userId);
  revalidateOpportunities(ctx.slug);
  revalidatePath(`/${ctx.slug}/contacts/${opp.contactId}`);
  return ok(undefined);
});
