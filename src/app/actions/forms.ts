"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";
import { validateFormDefinition } from "@/lib/crm/forms/shared";
import type { FormField, FormSettings } from "@/lib/crm/types";

/**
 * Server action per l'editor dei form. `saveForm` e' chiamata direttamente
 * (non tramite <form action=...>) dal componente client dell'editor, con
 * argomenti JSON-serializzabili: e' il pattern standard per le server action
 * invocate da un handler invece che da un submit di form.
 */

export const createForm = companyAction(async (ctx) => {
  const form = await ctx.db.form.create({
    data: { companyId: ctx.companyId, name: "Nuovo form", fields: [], settings: {}, active: false },
  });
  revalidatePath(`/${ctx.slug}/forms`);
  redirect(`/${ctx.slug}/forms/${form.id}`);
});

export const duplicateForm = companyAction(async (ctx, id: string) => {
  const original = await ctx.db.form.findUnique({ where: { id } });
  if (!original) throw new Error("Form non trovato");

  const copy = await ctx.db.form.create({
    data: {
      companyId: ctx.companyId,
      name: `${original.name} (copia)`,
      fields: original.fields as Prisma.InputJsonValue,
      settings: original.settings as Prisma.InputJsonValue,
      active: false,
    },
  });
  revalidatePath(`/${ctx.slug}/forms`);
  redirect(`/${ctx.slug}/forms/${copy.id}`);
});

export const deleteForm = companyAction(async (ctx, id: string) => {
  await ctx.db.form.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/forms`);
});

type SaveFormInput = {
  name: string;
  active: boolean;
  fields: FormField[];
  settings: FormSettings;
};

export const saveForm = companyAction(async (
  ctx,
  id: string,
  input: SaveFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const name = (input.name ?? "").trim().slice(0, 120) || "Senza nome";

  const defError = validateFormDefinition(input.fields, input.settings);
  if (defError) return { ok: false, error: defError };

  // Mai fidarsi che pipeline/fase/etichette scelte nell'editor esistano
  // ancora e appartengano a questa azienda: companyDb le filtra gia' per
  // companyId, quindi un findFirst/count che non trova nulla e' la prova che
  // l'id non e' valido per questa azienda (o e' stato cancellato nel
  // frattempo).
  if (input.settings.pipelineId && input.settings.stageId) {
    const stage = await ctx.db.pipelineStage.findFirst({
      where: { id: input.settings.stageId, pipelineId: input.settings.pipelineId },
    });
    if (!stage) return { ok: false, error: "Fase della pipeline non valida" };
  }
  if (input.settings.tagIds?.length) {
    const count = await ctx.db.crmTag.count({ where: { id: { in: input.settings.tagIds } } });
    if (count !== input.settings.tagIds.length) return { ok: false, error: "Una o più etichette non sono valide" };
  }

  await ctx.db.form.update({
    where: { id },
    data: {
      name,
      active: input.active,
      fields: input.fields as unknown as Prisma.InputJsonValue,
      settings: input.settings as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/${ctx.slug}/forms`);
  revalidatePath(`/${ctx.slug}/forms/${id}`);
  return { ok: true };
});
