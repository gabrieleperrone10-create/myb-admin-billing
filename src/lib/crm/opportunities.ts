import "server-only";
import type { CompanyDb, Prisma } from "@/lib/db";
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

// ═══════════════════════════════════════════════════════════════════════════
// Aggiunte agente D — kanban (spostamento, vinta/persa, modifica).
// createOpportunity() sopra resta invariata: e' un contratto condiviso con
// altri agenti (form pubblici, booking).
// ═══════════════════════════════════════════════════════════════════════════

const POSITION_GAP = 1000;

/**
 * Rinumera per intero le opportunita' di una fase con passo fisso, inserendo
 * `opportunityId` nel punto indicato da `beforeId`/`afterId` (id di schede
 * gia' in quella fase, quello che la trascinata affianca dopo il drop).
 * Chiamata solo quando lo spazio frazionario fra due vicini si e' esaurito,
 * o quando mancano riferimenti validi per calcolare un punto medio.
 * Restituisce la posizione assegnata alla scheda spostata.
 */
async function renormalizeStage(
  db: CompanyDb,
  stageId: string,
  opportunityId: string,
  beforeId?: string | null,
  afterId?: string | null,
): Promise<number> {
  const items = await db.opportunity.findMany({
    where: { stageId, id: { not: opportunityId } },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  const ids = items.map(i => i.id);

  let insertAt = ids.length; // default: in fondo
  if (beforeId) {
    const idx = ids.indexOf(beforeId);
    insertAt = idx >= 0 ? idx + 1 : ids.length;
  } else if (afterId) {
    const idx = ids.indexOf(afterId);
    insertAt = idx >= 0 ? idx : 0;
  } else {
    insertAt = 0; // niente vicini: in cima
  }

  const ordered = [...ids.slice(0, insertAt), opportunityId, ...ids.slice(insertAt)];
  await db.$transaction(
    ordered.map((id, i) => db.opportunity.update({ where: { id }, data: { position: (i + 1) * POSITION_GAP } })),
  );
  return (insertAt + 1) * POSITION_GAP;
}

/**
 * Sposta un'opportunita' di fase e/o posizione dentro la colonna del kanban.
 * `beforeId`/`afterId` sono gli id delle schede immediatamente sopra/sotto
 * il punto di drop nella colonna di ARRIVO (secondo l'ordine ottimistico
 * lato client): la posizione si ricalcola sempre da dati freschi del server,
 * mai dai valori numerici che il client potrebbe avere in cache.
 *
 * Se la fase di arrivo e' WON/LOST aggiorna status, closedAt, lostReason e
 * registra le attivita' corrispondenti. Cambiare fase resetta stageEnteredAt
 * (i "giorni nella fase" ripartono da zero); restare nella stessa fase (solo
 * riordino) lo lascia intatto.
 */
export async function moveOpportunity(
  db: CompanyDb,
  companyId: string,
  opportunityId: string,
  input: { stageId: string; beforeId?: string | null; afterId?: string | null; lostReason?: string | null },
  opts: { actorUserId?: string | null } = {},
) {
  const opp = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true, contactId: true, name: true, value: true, pipelineId: true,
      stageId: true, status: true, closedAt: true, lostReason: true,
      stage: { select: { name: true } },
    },
  });
  if (!opp) throw new Error("Opportunità non trovata");

  const stage = await db.pipelineStage.findFirst({ where: { id: input.stageId, pipelineId: opp.pipelineId } });
  if (!stage) throw new Error("Fase non trovata in questa pipeline");

  const isSameStage = stage.id === opp.stageId;

  const [before, after] = await Promise.all([
    input.beforeId ? db.opportunity.findFirst({ where: { id: input.beforeId, stageId: stage.id }, select: { position: true } }) : Promise.resolve(null),
    input.afterId ? db.opportunity.findFirst({ where: { id: input.afterId, stageId: stage.id }, select: { position: true } }) : Promise.resolve(null),
  ]);

  let position: number;
  if (before && after && after.position - before.position > 0.01) {
    position = (before.position + after.position) / 2;
  } else if (before && after) {
    position = await renormalizeStage(db, stage.id, opportunityId, input.beforeId, input.afterId);
  } else if (before && !after) {
    position = before.position + POSITION_GAP;
  } else if (!before && after) {
    position = after.position - POSITION_GAP;
  } else {
    const last = await db.opportunity.findFirst({
      where: { stageId: stage.id, id: { not: opportunityId } },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (last?.position ?? 0) + POSITION_GAP;
  }

  const status = stage.kind === "WON" ? "WON" : stage.kind === "LOST" ? "LOST" : "OPEN";
  const updated = await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      stageId: stage.id,
      position,
      status,
      stageEnteredAt: isSameStage ? undefined : new Date(),
      closedAt: status === "OPEN" ? null : (opp.closedAt ?? new Date()),
      lostReason: status === "LOST" ? (input.lostReason ?? opp.lostReason ?? null) : null,
    },
  });

  if (!isSameStage) {
    await db.opportunityStageChange.create({
      data: { companyId, opportunityId, fromStageId: opp.stageId, toStageId: stage.id, changedByUserId: opts.actorUserId ?? null },
    });
    await logActivity(db, companyId, {
      contactId: opp.contactId,
      opportunityId,
      type: "OPPORTUNITY_STAGE_CHANGED",
      data: { opportunityId, name: opp.name, fromStage: opp.stage.name, toStage: stage.name },
      actorUserId: opts.actorUserId,
    });
    if (status === "WON") {
      await logActivity(db, companyId, {
        contactId: opp.contactId,
        opportunityId,
        type: "OPPORTUNITY_WON",
        data: { opportunityId, name: opp.name, value: opp.value },
        actorUserId: opts.actorUserId,
      });
    } else if (status === "LOST") {
      await logActivity(db, companyId, {
        contactId: opp.contactId,
        opportunityId,
        type: "OPPORTUNITY_LOST",
        data: { opportunityId, name: opp.name, reason: input.lostReason ?? undefined },
        actorUserId: opts.actorUserId,
      });
    }
  }

  return updated;
}

/** Segna vinta spostando nella prima fase WON (per `order`) della pipeline corrente. */
export async function markWon(
  db: CompanyDb,
  companyId: string,
  opportunityId: string,
  opts: { actorUserId?: string | null } = {},
) {
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, select: { pipelineId: true } });
  if (!opp) throw new Error("Opportunità non trovata");
  const wonStage = await db.pipelineStage.findFirst({ where: { pipelineId: opp.pipelineId, kind: "WON" }, orderBy: { order: "asc" } });
  if (!wonStage) throw new Error("Questa pipeline non ha una fase Vinta");
  return moveOpportunity(db, companyId, opportunityId, { stageId: wonStage.id }, opts);
}

/** Segna persa spostando nella prima fase LOST (per `order`) della pipeline corrente. */
export async function markLost(
  db: CompanyDb,
  companyId: string,
  opportunityId: string,
  lostReason: string | null,
  opts: { actorUserId?: string | null } = {},
) {
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, select: { pipelineId: true } });
  if (!opp) throw new Error("Opportunità non trovata");
  const lostStage = await db.pipelineStage.findFirst({ where: { pipelineId: opp.pipelineId, kind: "LOST" }, orderBy: { order: "asc" } });
  if (!lostStage) throw new Error("Questa pipeline non ha una fase Persa");
  return moveOpportunity(db, companyId, opportunityId, { stageId: lostStage.id, lostReason }, opts);
}

/**
 * Modifica i campi anagrafici di un'opportunita' gia' esistente (drawer di
 * modifica). Non tocca fase/posizione: per quello c'e' moveOpportunity().
 * Se pipelineId cambia, stageId deve appartenere alla nuova pipeline (prima
 * fase OPEN se non specificata).
 */
export async function updateOpportunity(
  db: CompanyDb,
  companyId: string,
  opportunityId: string,
  input: {
    name?: string;
    contactId?: string;
    pipelineId?: string;
    stageId?: string;
    value?: number;
    ownerUserId?: string | null;
    productId?: string | null;
    expectedCloseDate?: Date | null;
    customFields?: Record<string, unknown>;
  },
  opts: { actorUserId?: string | null } = {},
) {
  // opts e' qui per uniformita' con le altre funzioni di questo file (chi
  // chiama passa sempre actorUserId): questa in particolare non scrive
  // Activity, perche' non esiste un ActivityType generico per "campi
  // modificati" sulle opportunita' — il cambio di fase/valore/proprietario
  // e' comunque tracciato via OpportunityStageChange quando cambia la fase.
  void opts;
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, select: { pipelineId: true, stageId: true } });
  if (!opp) throw new Error("Opportunità non trovata");

  if (input.contactId) {
    const contact = await db.contact.findUnique({ where: { id: input.contactId }, select: { id: true } });
    if (!contact) throw new Error("Contatto non trovato");
  }
  if (input.productId) {
    const product = await db.product.findUnique({ where: { id: input.productId }, select: { id: true } });
    if (!product) throw new Error("Prodotto non trovato");
  }

  const pipelineId = input.pipelineId ?? opp.pipelineId;
  if (input.pipelineId) {
    const pipeline = await db.pipeline.findUnique({ where: { id: input.pipelineId } });
    if (!pipeline) throw new Error("Pipeline non trovata");
  }

  let stageId = opp.stageId;
  if (input.stageId || (input.pipelineId && input.pipelineId !== opp.pipelineId)) {
    const stage = input.stageId
      ? await db.pipelineStage.findFirst({ where: { id: input.stageId, pipelineId } })
      : await db.pipelineStage.findFirst({ where: { pipelineId, kind: "OPEN" }, orderBy: { order: "asc" } });
    if (!stage) throw new Error("Fase non trovata in questa pipeline");
    stageId = stage.id;
  }

  return db.opportunity.update({
    where: { id: opportunityId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      pipelineId,
      stageId,
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate } : {}),
      ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
    },
  });
}
