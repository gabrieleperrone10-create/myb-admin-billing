"use server";

import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";
import { ensureDefaultPipeline } from "@/lib/crm/pipelines";

/**
 * Impostazioni pipeline (agente D). Ogni pipeline deve sempre avere almeno
 * una fase WON e una LOST: lo si impone qui, non solo in UI, perche' queste
 * action sono l'unico punto di scrittura su Pipeline/PipelineStage.
 */

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export const getPipelinesSettings = companyAction(async (ctx) => {
  await ensureDefaultPipeline(ctx.db, ctx.companyId);
  return ctx.db.pipeline.findMany({
    orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
    include: {
      stages: { orderBy: { order: "asc" }, include: { _count: { select: { opportunities: true } } } },
      _count: { select: { opportunities: true } },
    },
  });
});

export const createPipeline = companyAction(async (ctx, name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return fail("Il nome della pipeline è obbligatorio");

  const count = await ctx.db.pipeline.count();
  const pipeline = await ctx.db.pipeline.create({
    data: { companyId: ctx.companyId, name: trimmed, order: count, isDefault: count === 0 },
  });
  // Fasi minime obbligatorie: senza almeno una WON e una LOST la pipeline non è utilizzabile.
  await ctx.db.pipelineStage.createMany({
    data: [
      { companyId: ctx.companyId, pipelineId: pipeline.id, name: "In corso", order: 0, kind: "OPEN", probability: 50, color: "#60a5fa" },
      { companyId: ctx.companyId, pipelineId: pipeline.id, name: "Vinta", order: 1, kind: "WON", probability: 100, color: "#10b981" },
      { companyId: ctx.companyId, pipelineId: pipeline.id, name: "Persa", order: 2, kind: "LOST", probability: 0, color: "#ef4444" },
    ],
  });

  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok({ id: pipeline.id });
});

export const renamePipeline = companyAction(async (ctx, id: string, name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return fail("Il nome della pipeline è obbligatorio");
  const pipeline = await ctx.db.pipeline.findUnique({ where: { id } });
  if (!pipeline) return fail("Pipeline non trovata");

  await ctx.db.pipeline.update({ where: { id }, data: { name: trimmed } });
  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});

export const setDefaultPipeline = companyAction(async (ctx, id: string) => {
  const pipeline = await ctx.db.pipeline.findUnique({ where: { id } });
  if (!pipeline) return fail("Pipeline non trovata");

  await ctx.db.$transaction([
    ctx.db.pipeline.updateMany({ where: { NOT: { id } }, data: { isDefault: false } }),
    ctx.db.pipeline.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});

export const deletePipeline = companyAction(async (ctx, id: string) => {
  const total = await ctx.db.pipeline.count();
  if (total <= 1) return fail("Non puoi eliminare l'unica pipeline dell'azienda");

  const oppCount = await ctx.db.opportunity.count({ where: { pipelineId: id } });
  if (oppCount > 0) return fail(`Questa pipeline ha ${oppCount} opportunità: spostale o eliminale prima di eliminare la pipeline`);

  const pipeline = await ctx.db.pipeline.findUnique({ where: { id } });
  if (!pipeline) return fail("Pipeline non trovata");

  await ctx.db.pipeline.delete({ where: { id } });

  if (pipeline.isDefault) {
    const next = await ctx.db.pipeline.findFirst({ orderBy: { order: "asc" } });
    if (next) await ctx.db.pipeline.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});

export const createStage = companyAction(async (
  ctx,
  pipelineId: string,
  input: { name: string; color: string; probability: number | null; kind: "OPEN" | "WON" | "LOST" },
) => {
  const trimmed = input.name.trim();
  if (!trimmed) return fail("Il nome della fase è obbligatorio");
  const pipeline = await ctx.db.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) return fail("Pipeline non trovata");

  const count = await ctx.db.pipelineStage.count({ where: { pipelineId } });
  const stage = await ctx.db.pipelineStage.create({
    data: {
      companyId: ctx.companyId,
      pipelineId,
      name: trimmed,
      order: count,
      kind: input.kind,
      probability: input.probability,
      color: input.color || "#94a3b8",
    },
  });

  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok({ id: stage.id });
});

export const updateStage = companyAction(async (
  ctx,
  id: string,
  input: { name: string; color: string; probability: number | null; kind: "OPEN" | "WON" | "LOST" },
) => {
  const trimmed = input.name.trim();
  if (!trimmed) return fail("Il nome della fase è obbligatorio");
  const stage = await ctx.db.pipelineStage.findUnique({ where: { id } });
  if (!stage) return fail("Fase non trovata");

  if (stage.kind !== input.kind && (stage.kind === "WON" || stage.kind === "LOST")) {
    const siblings = await ctx.db.pipelineStage.count({ where: { pipelineId: stage.pipelineId, kind: stage.kind, id: { not: id } } });
    if (siblings === 0) {
      return fail(`Ogni pipeline deve avere almeno una fase ${stage.kind === "WON" ? "Vinta" : "Persa"}`);
    }
  }

  await ctx.db.pipelineStage.update({
    where: { id },
    data: { name: trimmed, color: input.color || "#94a3b8", probability: input.probability, kind: input.kind },
  });

  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});

export const deleteStage = companyAction(async (ctx, id: string, moveToStageId?: string) => {
  const stage = await ctx.db.pipelineStage.findUnique({ where: { id } });
  if (!stage) return fail("Fase non trovata");

  if (stage.kind === "WON" || stage.kind === "LOST") {
    const siblings = await ctx.db.pipelineStage.count({ where: { pipelineId: stage.pipelineId, kind: stage.kind, id: { not: id } } });
    if (siblings === 0) {
      return fail(`Ogni pipeline deve avere almeno una fase ${stage.kind === "WON" ? "Vinta" : "Persa"}: creane un'altra prima di eliminare questa`);
    }
  }

  const oppCount = await ctx.db.opportunity.count({ where: { stageId: id } });
  if (oppCount > 0) {
    if (!moveToStageId) return fail(`Questa fase ha ${oppCount} opportunità: scegli dove spostarle prima di eliminarla`);
    const target = await ctx.db.pipelineStage.findFirst({ where: { id: moveToStageId, pipelineId: stage.pipelineId } });
    if (!target) return fail("Fase di destinazione non valida");
    await ctx.db.opportunity.updateMany({
      where: { stageId: id },
      data: {
        stageId: moveToStageId,
        status: target.kind === "WON" ? "WON" : target.kind === "LOST" ? "LOST" : "OPEN",
        stageEnteredAt: new Date(),
      },
    });
  }

  await ctx.db.pipelineStage.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});

export const reorderStages = companyAction(async (ctx, pipelineId: string, orderedIds: string[]) => {
  const stages = await ctx.db.pipelineStage.findMany({ where: { pipelineId }, select: { id: true } });
  const known = new Set(stages.map(s => s.id));
  if (orderedIds.length !== stages.length || orderedIds.some(id => !known.has(id))) {
    return fail("Elenco fasi non valido");
  }
  await ctx.db.$transaction(
    orderedIds.map((id, i) => ctx.db.pipelineStage.update({ where: { id }, data: { order: i } })),
  );
  revalidatePath(`/${ctx.slug}/settings/pipelines`);
  return ok(undefined);
});
