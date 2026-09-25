"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Contact, ContactLifecycle, Prisma } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { companyAction } from "@/lib/companyAction";
import { upsertContact, setLifecycle, normalizeEmail } from "@/lib/crm/contacts";
import { normalizePhone } from "@/lib/crm/phone";
import { logActivity } from "@/lib/crm/activity";
import { validateCustomFields, type CustomFieldValues } from "@/lib/crm/customFields";

/**
 * Server action per la lista contatti, il nuovo contatto e l'import CSV.
 * Tutte passano da companyAction(): ricevono lo slug (non fidato) e un ctx
 * gia' verificato. Vedi src/lib/companyAction.ts.
 */

const LIFECYCLES = ["LEAD", "CUSTOMER", "ARCHIVED"] as const;

function revalidateContacts(slug: string) {
  revalidatePath(`/${slug}/contacts`);
}

// ─── Ricerca duplicati (nuovo contatto) ────────────────────────────────────

export const lookupContactByIdentity = companyAction(async (ctx, input: { email?: string; phone?: string }) => {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return null;

  const existing =
    (email ? await ctx.db.contact.findFirst({ where: { email } }) : null) ??
    (phone ? await ctx.db.contact.findFirst({ where: { phone } }) : null);

  if (!existing) return null;
  const name = [existing.firstName, existing.lastName].filter(Boolean).join(" ").trim()
    || existing.companyName || existing.email || existing.phone || "Senza nome";
  return { id: existing.id, name };
});

// ─── Nuovo contatto ─────────────────────────────────────────────────────────

const MAX_ASSIGNEES = 20;

const newContactSchema = z.object({
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(60).optional(),
  whatsapp: z.string().trim().max(60).optional(),
  companyName: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  ownerUserId: z.string().trim().optional(),
  tagIds: z.array(z.string()).default([]),
  assigneeUserIds: z.array(z.string()).max(MAX_ASSIGNEES).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CreateContactInput = z.input<typeof newContactSchema>;

export const createContact = companyAction(async (ctx, rawInput: CreateContactInput) => {
  const parsed = newContactSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Dati non validi.", fieldErrors: {} };
  const input = parsed.data;

  if (!input.email?.trim() && !input.phone?.trim() && !input.whatsapp?.trim()) {
    return { ok: false as const, error: "Serve almeno email o telefono per creare il contatto.", fieldErrors: {} };
  }

  const defs = await ctx.db.customFieldDef.findMany({ where: { entity: "CONTACT" } });
  const validated = validateCustomFields(defs, input.customFields, { partial: true });
  if (!validated.ok) {
    return { ok: false as const, error: "Controlla i campi personalizzati.", fieldErrors: validated.errors };
  }

  // gli id dei tag vanno verificati: appartengono a QUESTA azienda? ctx.db.crmTag e' gia' filtrato.
  const tagIds = input.tagIds.length
    ? (await ctx.db.crmTag.findMany({ where: { id: { in: input.tagIds } }, select: { id: true } })).map(t => t.id)
    : [];

  const ownerUserId = input.ownerUserId?.trim() || null;
  if (ownerUserId) {
    const isMember = await ctx.db.companyMember.findFirst({ where: { clerkUserId: ownerUserId, companyId: ctx.companyId } });
    if (!isMember) return { ok: false as const, error: "Responsabile non valido.", fieldErrors: {} };
  }

  const assigneeUserIds = Array.from(new Set(input.assigneeUserIds.map(id => id.trim()).filter(Boolean)));
  if (assigneeUserIds.length) {
    const validMembers = await ctx.db.companyMember.findMany({
      where: { companyId: ctx.companyId, clerkUserId: { in: assigneeUserIds } },
      select: { clerkUserId: true },
    });
    if (validMembers.length !== assigneeUserIds.length) {
      return { ok: false as const, error: "Uno o più assegnatari non sono validi.", fieldErrors: {} };
    }
  }

  let contact: Contact;
  let created: boolean;
  try {
    ({ contact, created } = await upsertContact(ctx.db, ctx.companyId, {
      email: input.email || null,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      companyName: input.companyName || null,
      jobTitle: input.jobTitle || null,
      ownerUserId,
      source: "manual",
      customFields: validated.values,
    }, { actorUserId: ctx.userId }));
  } catch (e) {
    // upsertContact lancia se email/telefono non sono validi (normalizzati a null da entrambi).
    return { ok: false as const, error: e instanceof Error ? e.message : "Email o telefono non validi.", fieldErrors: {} };
  }

  for (const tagId of tagIds) {
    await ctx.db.contactTag.upsert({
      where: { contactId_tagId: { contactId: contact.id, tagId } },
      create: { companyId: ctx.companyId, contactId: contact.id, tagId },
      update: {},
    });
    const tag = await ctx.db.crmTag.findUnique({ where: { id: tagId } });
    if (tag) {
      await logActivity(ctx.db, ctx.companyId, {
        contactId: contact.id, type: "TAG_ADDED", data: { tagId, name: tag.name }, actorUserId: ctx.userId,
      });
    }
  }

  if (assigneeUserIds.length) {
    await ctx.db.contactAssignee.createMany({
      data: assigneeUserIds.map(userId => ({ contactId: contact.id, userId, companyId: ctx.companyId })),
      skipDuplicates: true,
    });
    await logActivity(ctx.db, ctx.companyId, {
      contactId: contact.id, type: "CONTACT_UPDATED", data: { fields: ["assignees"] }, actorUserId: ctx.userId,
    });
  }

  revalidateContacts(ctx.slug);
  return { ok: true as const, contactId: contact.id, duplicate: !created };
});

// ─── Azioni di gruppo ───────────────────────────────────────────────────────

const idsSchema = z.array(z.string().min(1)).min(1).max(2000);

/** Verifica che gli id passati dal client appartengano davvero all'azienda corrente. */
async function verifyContactIds(db: CompanyDb, ids: string[]) {
  const rows = await db.contact.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map(r => r.id);
}

export const bulkAddTag = companyAction(async (ctx, contactIdsRaw: string[], tagId: string) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  const tag = await ctx.db.crmTag.findUnique({ where: { id: tagId } });
  if (!tag) return { ok: false as const, error: "Etichetta non trovata." };
  const validIds = await verifyContactIds(ctx.db, contactIds);

  for (const contactId of validIds) {
    const already = await ctx.db.contactTag.findUnique({ where: { contactId_tagId: { contactId, tagId } } });
    if (already) continue;
    await ctx.db.contactTag.create({ data: { companyId: ctx.companyId, contactId, tagId } });
    await logActivity(ctx.db, ctx.companyId, { contactId, type: "TAG_ADDED", data: { tagId, name: tag.name }, actorUserId: ctx.userId });
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: validIds.length };
});

export const bulkRemoveTag = companyAction(async (ctx, contactIdsRaw: string[], tagId: string) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  const tag = await ctx.db.crmTag.findUnique({ where: { id: tagId } });
  if (!tag) return { ok: false as const, error: "Etichetta non trovata." };
  const validIds = await verifyContactIds(ctx.db, contactIds);

  for (const contactId of validIds) {
    const removed = await ctx.db.contactTag.deleteMany({ where: { contactId, tagId } });
    if (removed.count > 0) {
      await logActivity(ctx.db, ctx.companyId, { contactId, type: "TAG_REMOVED", data: { tagId, name: tag.name }, actorUserId: ctx.userId });
    }
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: validIds.length };
});

export const bulkAssignOwner = companyAction(async (ctx, contactIdsRaw: string[], ownerUserId: string | null) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  if (ownerUserId) {
    const isMember = await ctx.db.companyMember.findFirst({ where: { clerkUserId: ownerUserId, companyId: ctx.companyId } });
    if (!isMember) return { ok: false as const, error: "Responsabile non valido." };
  }
  const validIds = await verifyContactIds(ctx.db, contactIds);
  for (const contactId of validIds) {
    await ctx.db.contact.update({ where: { id: contactId }, data: { ownerUserId } });
    await logActivity(ctx.db, ctx.companyId, { contactId, type: "CONTACT_UPDATED", data: { fields: ["ownerUserId"] }, actorUserId: ctx.userId });
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: validIds.length };
});

/**
 * Aggiunge un assegnatario ai contatti indicati, in aggiunta al responsabile.
 * Idempotente: skipDuplicates (ContactAssignee ha @@unique([contactId, userId])).
 * ContactAssignee non e' un TENANT_MODEL (vedi src/lib/db.ts): companyId va
 * passato a mano, come per setContactAssignees in contactDetail.ts.
 */
export const bulkAddAssignee = companyAction(async (ctx, contactIdsRaw: string[], userId: string) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  const isMember = await ctx.db.companyMember.findFirst({ where: { clerkUserId: userId, companyId: ctx.companyId } });
  if (!isMember) return { ok: false as const, error: "Utente non valido." };
  const validIds = await verifyContactIds(ctx.db, contactIds);

  if (validIds.length) {
    await ctx.db.contactAssignee.createMany({
      data: validIds.map(contactId => ({ contactId, userId, companyId: ctx.companyId })),
      skipDuplicates: true,
    });
    for (const contactId of validIds) {
      await logActivity(ctx.db, ctx.companyId, { contactId, type: "CONTACT_UPDATED", data: { fields: ["assignees"] }, actorUserId: ctx.userId });
    }
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: validIds.length };
});

export const bulkRemoveAssignee = companyAction(async (ctx, contactIdsRaw: string[], userId: string) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  const validIds = await verifyContactIds(ctx.db, contactIds);

  let removedCount = 0;
  for (const contactId of validIds) {
    const removed = await ctx.db.contactAssignee.deleteMany({ where: { contactId, userId, companyId: ctx.companyId } });
    if (removed.count > 0) {
      removedCount++;
      await logActivity(ctx.db, ctx.companyId, { contactId, type: "CONTACT_UPDATED", data: { fields: ["assignees"] }, actorUserId: ctx.userId });
    }
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: removedCount };
});

export const bulkSetLifecycle = companyAction(async (ctx, contactIdsRaw: string[], lifecycle: ContactLifecycle) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  if (!LIFECYCLES.includes(lifecycle)) return { ok: false as const, error: "Stato non valido." };
  const validIds = await verifyContactIds(ctx.db, contactIds);
  for (const contactId of validIds) {
    await setLifecycle(ctx.db, ctx.companyId, contactId, lifecycle, ctx.userId);
  }
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: validIds.length };
});

export const bulkDeleteContacts = companyAction(async (ctx, contactIdsRaw: string[]) => {
  const contactIds = idsSchema.parse(contactIdsRaw);
  const validIds = await verifyContactIds(ctx.db, contactIds);
  const result = await ctx.db.contact.deleteMany({ where: { id: { in: validIds } } });
  revalidateContacts(ctx.slug);
  return { ok: true as const, count: result.count };
});

// ─── Viste salvate ──────────────────────────────────────────────────────────

const saveViewSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
  columns: z.array(z.string()),
  sort: z.record(z.string(), z.unknown()).nullable().optional(),
  isShared: z.boolean().default(false),
});

export const saveContactView = companyAction(async (ctx, rawInput: z.input<typeof saveViewSchema>) => {
  const parsed = saveViewSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Vista non valida." };
  const input = parsed.data;

  if (input.id) {
    // solo chi l'ha creata puo' modificarla: ctx.db non filtra per clerkUserId, va fatto a mano.
    const existing = await ctx.db.savedView.findUnique({ where: { id: input.id } });
    if (!existing || existing.clerkUserId !== ctx.userId) return { ok: false as const, error: "Vista non trovata." };
    const view = await ctx.db.savedView.update({
      where: { id: input.id },
      data: {
        name: input.name,
        filters: input.filters as Prisma.InputJsonValue,
        columns: input.columns as Prisma.InputJsonValue,
        sort: (input.sort ?? undefined) as Prisma.InputJsonValue,
        isShared: input.isShared,
      },
    });
    revalidateContacts(ctx.slug);
    return { ok: true as const, id: view.id };
  }

  const view = await ctx.db.savedView.create({
    data: {
      companyId: ctx.companyId,
      clerkUserId: ctx.userId,
      entity: "CONTACT",
      name: input.name,
      filters: input.filters as Prisma.InputJsonValue,
      columns: input.columns as Prisma.InputJsonValue,
      sort: (input.sort ?? undefined) as Prisma.InputJsonValue,
      isShared: input.isShared,
    },
  });
  revalidateContacts(ctx.slug);
  return { ok: true as const, id: view.id };
});

export const deleteContactView = companyAction(async (ctx, id: string) => {
  const existing = await ctx.db.savedView.findUnique({ where: { id } });
  if (!existing || existing.clerkUserId !== ctx.userId) return { ok: false as const, error: "Vista non trovata." };
  await ctx.db.savedView.delete({ where: { id } });
  revalidateContacts(ctx.slug);
  return { ok: true as const };
});

// ─── Import CSV ─────────────────────────────────────────────────────────────

const MAX_IMPORT_ROWS = 5000;

const importRowSchema = z.record(z.string(), z.string());
const importBatchSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(500),
  mapping: z.record(z.string(), z.string()), // header csv -> "std:<key>" | "cf:<key>" | "skip"
  defaultTagIds: z.array(z.string()).default([]),
  defaultLifecycle: z.enum(LIFECYCLES).default("LEAD"),
  defaultAssigneeUserIds: z.array(z.string()).max(MAX_ASSIGNEES).default([]),
});

export type ImportRowResult = { row: number; status: "created" | "updated" | "skipped"; reason?: string };

/**
 * Importa un lotto di righe (client-side batching: vedi ImportWizard). Ogni
 * riga passa da upsertContact (deduplica per email/telefono) + validateCustomFields.
 * Nessun controllo sul totale importato finora: e' il client a spezzare in lotti
 * e a fermarsi al limite MAX_IMPORT_ROWS complessivo.
 */
export const importContactsBatch = companyAction(async (ctx, rawInput: z.input<typeof importBatchSchema>) => {
  const parsed = importBatchSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Lotto non valido.", results: [] as ImportRowResult[] };
  const { rows, mapping, defaultTagIds, defaultLifecycle, defaultAssigneeUserIds } = parsed.data;

  const defs = await ctx.db.customFieldDef.findMany({ where: { entity: "CONTACT" } });
  const tagIds = defaultTagIds.length
    ? (await ctx.db.crmTag.findMany({ where: { id: { in: defaultTagIds } }, select: { id: true, name: true } }))
    : [];

  // Verifica una sola volta per lotto: chi non e' (piu') membro viene scartato
  // in silenzio invece di far fallire l'intero import (i lotti successivi
  // dello stesso wizard client condividono la stessa selezione, vedi ImportWizard).
  const assigneeUserIds = defaultAssigneeUserIds.length
    ? (await ctx.db.companyMember.findMany({
        where: { companyId: ctx.companyId, clerkUserId: { in: defaultAssigneeUserIds } },
        select: { clerkUserId: true },
      })).map(m => m.clerkUserId)
    : [];

  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    try {
      const std: Record<string, string> = {};
      const custom: Record<string, unknown> = {};
      for (const [header, target] of Object.entries(mapping)) {
        if (!target || target === "skip") continue;
        const value = raw[header];
        if (value === undefined) continue;
        if (target.startsWith("std:")) std[target.slice(4)] = value;
        else if (target.startsWith("cf:")) custom[target.slice(3)] = value;
      }

      if (!std.email?.trim() && !std.phone?.trim() && !std.whatsapp?.trim()) {
        results.push({ row: i, status: "skipped", reason: "Nessuna email o telefono" });
        continue;
      }

      const validated = validateCustomFields(defs, custom, { partial: true });
      if (!validated.ok) {
        results.push({ row: i, status: "skipped", reason: Object.values(validated.errors).join("; ") });
        continue;
      }

      const { contact, created } = await upsertContact(ctx.db, ctx.companyId, {
        email: std.email || null,
        phone: std.phone || null,
        whatsapp: std.whatsapp || null,
        firstName: std.firstName || null,
        lastName: std.lastName || null,
        companyName: std.companyName || null,
        jobTitle: std.jobTitle || null,
        source: "import",
        customFields: validated.values as CustomFieldValues,
      }, { actorUserId: ctx.userId });

      // Il lifecycle di default si applica solo ai contatti NUOVI: uno gia'
      // esistente (created=false) mantiene il proprio stato, upsertContact lo
      // riporta a LEAD da solo se era ARCHIVED (vedi mergeInto in contacts.ts).
      if (created && defaultLifecycle !== "LEAD") {
        await setLifecycle(ctx.db, ctx.companyId, contact.id, defaultLifecycle, ctx.userId);
      }

      for (const tag of tagIds) {
        const already = await ctx.db.contactTag.findUnique({ where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } } });
        if (!already) {
          await ctx.db.contactTag.create({ data: { companyId: ctx.companyId, contactId: contact.id, tagId: tag.id } });
          await logActivity(ctx.db, ctx.companyId, { contactId: contact.id, type: "TAG_ADDED", data: { tagId: tag.id, name: tag.name }, actorUserId: ctx.userId });
        }
      }

      if (assigneeUserIds.length) {
        await ctx.db.contactAssignee.createMany({
          data: assigneeUserIds.map(userId => ({ contactId: contact.id, userId, companyId: ctx.companyId })),
          skipDuplicates: true,
        });
        await logActivity(ctx.db, ctx.companyId, { contactId: contact.id, type: "CONTACT_UPDATED", data: { fields: ["assignees"] }, actorUserId: ctx.userId });
      }

      results.push({ row: i, status: created ? "created" : "updated" });
    } catch (e) {
      results.push({ row: i, status: "skipped", reason: e instanceof Error ? e.message : "Errore sconosciuto" });
    }
  }

  revalidateContacts(ctx.slug);
  return { ok: true as const, results, limit: MAX_IMPORT_ROWS };
});
