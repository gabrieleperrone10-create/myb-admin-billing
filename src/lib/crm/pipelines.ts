import "server-only";
import type { CompanyDb } from "@/lib/db";

const DEFAULT_STAGES = [
  { name: "Nuovo lead", kind: "OPEN", probability: 10, color: "#94a3b8" },
  { name: "Contattato", kind: "OPEN", probability: 25, color: "#60a5fa" },
  { name: "Call fissata", kind: "OPEN", probability: 50, color: "#a78bfa" },
  { name: "Proposta inviata", kind: "OPEN", probability: 75, color: "#f59e0b" },
  { name: "Vinto", kind: "WON", probability: 100, color: "#10b981" },
  { name: "Perso", kind: "LOST", probability: 0, color: "#ef4444" },
] as const;

/**
 * Crea la pipeline "Vendite" con fasi predefinite se l'azienda non ne ha
 * nessuna. Chiamata in modo pigro dalle pagine che ne hanno bisogno, cosi'
 * vale anche per le aziende create dopo il rilascio del CRM senza toccare il
 * provisioning.
 */
export async function ensureDefaultPipeline(db: CompanyDb, companyId: string) {
  const existing = await db.pipeline.findFirst({ orderBy: [{ isDefault: "desc" }, { order: "asc" }] });
  if (existing) return existing;
  const pipeline = await db.pipeline.create({
    data: { companyId, name: "Vendite", isDefault: true, order: 0 },
  });
  await db.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ ...s, companyId, pipelineId: pipeline.id, order: i })),
  });
  return pipeline;
}
