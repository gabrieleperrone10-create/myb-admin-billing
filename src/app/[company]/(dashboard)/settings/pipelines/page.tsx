export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { ensureDefaultPipeline } from "@/lib/crm/pipelines";
import PipelinesClient from "./PipelinesClient";

export default async function PipelinesSettingsPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const { db, companyId } = await requireCompany(slug);

  // Al primo accesso crea la pipeline predefinita se l'azienda non ne ha nessuna.
  await ensureDefaultPipeline(db, companyId);

  const pipelines = await db.pipeline.findMany({
    orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
    include: {
      stages: { orderBy: { order: "asc" }, include: { _count: { select: { opportunities: true } } } },
      _count: { select: { opportunities: true } },
    },
  });

  return (
    <div className="max-w-[900px] space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>
          Pipeline
        </h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          Configura le pipeline di vendita e le fasi del kanban opportunità
        </p>
      </div>

      <PipelinesClient slug={slug} pipelines={pipelines} />
    </div>
  );
}
