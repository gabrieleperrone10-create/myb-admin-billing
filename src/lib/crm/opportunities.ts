import "server-only";
import type { CompanyDb } from "@/lib/db";
import { logActivity } from "./activity";
import { ensureDefaultPipeline } from "./pipelines";

/**
 * Crea un'opportunita' registrando storico fasi e attivita'.
 * Usata da kanban, form pubblici e booking: la firma e' un contratto condiviso.
 *
 * Senza pipelineId usa la pipeline predefinita; senza stageId la prima fase
 * OPEN. La posizione la mette in fondo alla colonna.
 */
export async function createOpportunity(
  db: CompanyDb,
  companyId: string,
  input: {
    contactId: string;
    pipelineId?: string | null;
    stageId?: string | null;
    name?: string | null;
    value?: number | null;
    ownerUserId?: string | null;
    productId?: string | null;
    source?: string | null;
    expectedCloseDate?: Date | null;
  },
  opts: { actorUserId?: string | null } = {},
) {
  const pipeline = input.pipelineId
    ? await db.pipeline.findUnique({ where: { id: input.pipelineId } })
    : await ensureDefaultPipeline(db, companyId);
  if (!pipeline) throw new Error("Pipeline non trovata");

  const stage = input.stageId
    ? await db.pipelineStage.findFirst({ where: { id: input.stageId, pipelineId: pipeline.id } })
    : await db.pipelineStage.findFirst({ where: { pipelineId: pipeline.id, kind: "OPEN" }, orderBy: { order: "asc" } });
  if (!stage) throw new Error("Fase della pipeline non trovata");

  const contact = await db.contact.findUnique({
    where: { id: input.contactId },
    select: { firstName: true, lastName: true, email: true, companyName: true, ownerUserId: true },
  });
  if (!contact) throw new Error("Contatto non trovato");

  const last = await db.opportunity.findFirst({
    where: { stageId: stage.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const name = input.name?.trim()
    || [contact.firstName, contact.lastName].filter(Boolean).join(" ")
    || contact.companyName || contact.email || "Nuova opportunità";

  const status = stage.kind === "WON" ? "WON" : stage.kind === "LOST" ? "LOST" : "OPEN";
  const opp = await db.opportunity.create({
    data: {
      companyId,
      contactId: input.contactId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      name,
      status,
      value: input.value ?? 0,
      ownerUserId: input.ownerUserId ?? contact.ownerUserId ?? null,
      productId: input.productId ?? null,
      source: input.source ?? null,
      expectedCloseDate: input.expectedCloseDate ?? null,
      position: (last?.position ?? 0) + 1000,
      closedAt: status === "OPEN" ? null : new Date(),
    },
  });

  await db.opportunityStageChange.create({
    data: { companyId, opportunityId: opp.id, fromStageId: null, toStageId: stage.id, changedByUserId: opts.actorUserId ?? null },
  });
  await logActivity(db, companyId, {
    contactId: input.contactId,
    opportunityId: opp.id,
    type: "OPPORTUNITY_CREATED",
    data: { opportunityId: opp.id, name, pipelineName: pipeline.name, stageName: stage.name, value: opp.value },
    actorUserId: opts.actorUserId,
  });
  return opp;
}
