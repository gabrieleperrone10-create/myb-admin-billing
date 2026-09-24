"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { CustomFieldEntity } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { companyAction } from "@/lib/companyAction";
import { fieldKeyFromLabel, CUSTOM_FIELD_TYPE_LABEL } from "@/lib/crm/customFields";

/**
 * CRUD delle impostazioni CRM: campi personalizzati (CustomFieldDef, entita'
 * CONTACT e OPPORTUNITY) ed etichette (CrmTag). Usate da
 * /settings/crm/fields e /settings/crm/tags.
 */

function revalidateCrmSettings(slug: string) {
  revalidatePath(`/${slug}/settings/crm/fields`);
  revalidatePath(`/${slug}/settings/crm/tags`);
  revalidatePath(`/${slug}/contacts`);
  revalidatePath(`/${slug}/contacts/new`);
}

const FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABEL) as (keyof typeof CUSTOM_FIELD_TYPE_LABEL)[];
const ENTITIES = ["CONTACT", "OPPORTUNITY"] as const;

// ─── Campi personalizzati ───────────────────────────────────────────────────

const createFieldSchema = z.object({
  entity: z.enum(ENTITIES),
  label: z.string().trim().min(1).max(80),
  type: z.enum(FIELD_TYPES as [string, ...string[]]),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().default(false),
});

async function uniqueKey(
  db: CompanyDb,
  entity: CustomFieldEntity,
  label: string,
) {
  const base = fieldKeyFromLabel(label);
  let key = base;
  let n = 2;
  // la key e' immutabile dopo la creazione: qui si evita solo la collisione iniziale.
  while (await db.customFieldDef.findFirst({ where: { entity, key } })) {
    key = `${base}_${n++}`;
  }
  return key;
}

export const createCustomFieldDef = companyAction(async (ctx, rawInput: z.input<typeof createFieldSchema>) => {
  const parsed = createFieldSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Dati non validi." };
  const input = parsed.data;

  const needsOptions = input.type === "SELECT" || input.type === "MULTISELECT";
  if (needsOptions && (!input.options || input.options.length === 0)) {
    return { ok: false as const, error: "Aggiungi almeno un'opzione." };
  }

  const key = await uniqueKey(ctx.db, input.entity as CustomFieldEntity, input.label);
  const maxOrder = await ctx.db.customFieldDef.aggregate({
    where: { entity: input.entity as CustomFieldEntity },
    _max: { order: true },
  });

  const def = await ctx.db.customFieldDef.create({
    data: {
      companyId: ctx.companyId,
      entity: input.entity as CustomFieldEntity,
      key,
      label: input.label,
      type: input.type as never,
      options: needsOptions ? input.options : undefined,
      required: input.required,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  revalidateCrmSettings(ctx.slug);
  return { ok: true as const, id: def.id };
});

const updateFieldSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().optional(),
});

export const updateCustomFieldDef = companyAction(async (ctx, id: string, rawInput: z.input<typeof updateFieldSchema>) => {
  const parsed = updateFieldSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Dati non validi." };
  const existing = await ctx.db.customFieldDef.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "Campo non trovato." };

  const needsOptions = existing.type === "SELECT" || existing.type === "MULTISELECT";
  if (needsOptions && parsed.data.options && parsed.data.options.length === 0) {
    return { ok: false as const, error: "Aggiungi almeno un'opzione." };
  }

  await ctx.db.customFieldDef.update({
    where: { id },
    data: {
      label: parsed.data.label,
      options: parsed.data.options,
      required: parsed.data.required,
    },
  });
  revalidateCrmSettings(ctx.slug);
  return { ok: true as const };
});

/**
 * Elimina la definizione del campo. I valori gia' salvati in
 * Contact.customFields / Opportunity.customFields NON vengono toccati (sono
 * un blob JSON, non una FK): restano nel database ma spariscono dalla UI,
 * perche' senza una CustomFieldDef nessuna pagina sa piu' come mostrarli.
 */
export const deleteCustomFieldDef = companyAction(async (ctx, id: string) => {
  await ctx.db.customFieldDef.delete({ where: { id } });
  revalidateCrmSettings(ctx.slug);
  return { ok: true as const };
});

export const reorderCustomFieldDefs = companyAction(async (ctx, entity: CustomFieldEntity, orderedIds: string[]) => {
  const ids = z.array(z.string()).parse(orderedIds);
  await Promise.all(ids.map((id, index) =>
    ctx.db.customFieldDef.update({ where: { id }, data: { order: index } }).catch(() => null),
  ));
  revalidateCrmSettings(ctx.slug);
  return { ok: true as const };
});

// ─── Etichette (CrmTag) ─────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const tagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(HEX_COLOR, "Colore non valido").default("#4f7deb"),
});

export const createCrmTag = companyAction(async (ctx, rawInput: z.input<typeof tagSchema>) => {
  const parsed = tagSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Dati non validi." };
  try {
    const tag = await ctx.db.crmTag.create({ data: { companyId: ctx.companyId, ...parsed.data } });
    revalidateCrmSettings(ctx.slug);
    return { ok: true as const, id: tag.id };
  } catch {
    return { ok: false as const, error: "Esiste gia' un'etichetta con questo nome." };
  }
});

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(HEX_COLOR, "Colore non valido").optional(),
});

export const updateCrmTag = companyAction(async (ctx, id: string, rawInput: z.input<typeof updateTagSchema>) => {
  const parsed = updateTagSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "Dati non validi." };
  try {
    await ctx.db.crmTag.update({ where: { id }, data: parsed.data });
    revalidateCrmSettings(ctx.slug);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Esiste gia' un'etichetta con questo nome." };
  }
});

export const deleteCrmTag = companyAction(async (ctx, id: string) => {
  // onDelete: Cascade su ContactTag rimuove anche le associazioni ai contatti.
  await ctx.db.crmTag.delete({ where: { id } });
  revalidateCrmSettings(ctx.slug);
  return { ok: true as const };
});
