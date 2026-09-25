export const dynamic = "force-dynamic";
import { Suspense } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { ensureDefaultPipeline } from "@/lib/crm/pipelines";
import { listCompanyMembers } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import { OpportunityFilters } from "@/components/crm/opportunities/OpportunityFilters";
import { KanbanBoard } from "@/components/crm/opportunities/KanbanBoard";
import { OpportunityListView } from "@/components/crm/opportunities/OpportunityListView";
import type { OpportunityCardData } from "@/components/crm/opportunities/types";
import { startOfDayInTz } from "@/lib/crm/tasks";
import type { NextTaskSummary } from "@/components/crm/tasks/types";
import type { Prisma } from "@/lib/db";

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ pipeline?: string; owner?: string; status?: string; q?: string; view?: string; sort?: string; dir?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const { db, companyId, company, perms } = await requireCompany(slug);

  await ensureDefaultPipeline(db, companyId);

  const [pipelinesRaw, members, products, customFieldDefsRaw] = await Promise.all([
    db.pipeline.findMany({
      orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
      include: { stages: { orderBy: { order: "asc" } } },
    }),
    listCompanyMembers(companyId),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, basePrice: true } }),
    db.customFieldDef.findMany({ where: { entity: "OPPORTUNITY" }, orderBy: { order: "asc" } }),
  ]);

  const pipelines = pipelinesRaw.map(p => ({
    id: p.id, name: p.name, isDefault: p.isDefault,
    stages: p.stages.map(s => ({ id: s.id, name: s.name, order: s.order, kind: s.kind, probability: s.probability, color: s.color })),
  }));

  const currentPipelineId = sp.pipeline && pipelines.some(p => p.id === sp.pipeline)
    ? sp.pipeline
    : (pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id ?? "");
  const currentPipeline = pipelines.find(p => p.id === currentPipelineId);
  const stages = currentPipeline?.stages ?? [];

  const customFieldDefs = customFieldDefsRaw.map(d => ({
    id: d.id, key: d.key, label: d.label, type: d.type, required: d.required,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
  }));

  const where: Prisma.OpportunityWhereInput = { pipelineId: currentPipelineId };
  if (sp.owner) where.ownerUserId = sp.owner;
  if (sp.status === "open") where.status = "OPEN";
  else if (sp.status === "won") where.status = "WON";
  else if (sp.status === "lost") where.status = "LOST";
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { contact: { firstName: { contains: sp.q, mode: "insensitive" } } },
      { contact: { lastName: { contains: sp.q, mode: "insensitive" } } },
      { contact: { email: { contains: sp.q, mode: "insensitive" } } },
      { contact: { companyName: { contains: sp.q, mode: "insensitive" } } },
    ];
  }

  const rows = currentPipelineId
    ? await db.opportunity.findMany({
        where,
        orderBy: { position: "asc" },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
          product: { select: { name: true } },
        },
      })
    : [];

  const opportunities: OpportunityCardData[] = rows.map(o => ({
    id: o.id,
    name: o.name,
    value: o.value,
    status: o.status,
    pipelineId: o.pipelineId,
    stageId: o.stageId,
    position: o.position,
    ownerUserId: o.ownerUserId,
    productId: o.productId,
    productName: o.product?.name ?? null,
    expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString() : null,
    stageEnteredAt: o.stageEnteredAt.toISOString(),
    lostReason: o.lostReason,
    customFields: (o.customFields as Record<string, unknown>) ?? {},
    contact: { id: o.contact.id, name: contactDisplayName(o.contact), email: o.contact.email, companyName: o.contact.companyName },
  }));

  // Prossimo task aperto per opportunità (agente Task), per il badge sulla card kanban.
  const openOppIds = rows.filter(o => o.status === "OPEN").map(o => o.id);
  const nextTasks = openOppIds.length
    ? await db.task.findMany({
        where: { opportunityId: { in: openOppIds }, status: "OPEN" },
        orderBy: { dueAt: "asc" }, // NULLS LAST su Postgres: prima le scadenze reali
        select: { id: true, title: true, type: true, dueAt: true, opportunityId: true },
      })
    : [];
  const startOfTodayUtc = startOfDayInTz(new Date(), company.timezone).getTime();
  const nextTaskByOpportunity: Record<string, NextTaskSummary> = {};
  for (const t of nextTasks) {
    if (!t.opportunityId || nextTaskByOpportunity[t.opportunityId]) continue; // gia' preso il piu' vicino
    nextTaskByOpportunity[t.opportunityId] = {
      id: t.id,
      title: t.title,
      type: t.type,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      overdue: !!t.dueAt && t.dueAt.getTime() < startOfTodayUtc,
    };
  }

  const view = sp.view === "list" ? "list" : "kanban";

  let listOpportunities = opportunities;
  if (view === "list") {
    const sort = sp.sort ?? "updated";
    const dir = sp.dir === "asc" ? 1 : -1;
    const stageOrder = new Map(stages.map(s => [s.id, s.order]));
    listOpportunities = [...opportunities].sort((a, b) => {
      switch (sort) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "value": return dir * (a.value - b.value);
        case "stage": return dir * ((stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0));
        case "closeDate": {
          const av = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
          const bv = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
          return dir * (av - bv);
        }
        default: return dir * (new Date(a.stageEnteredAt).getTime() - new Date(b.stageEnteredAt).getTime());
      }
    });
  }

  const memberOptions = members.map(m => ({ userId: m.userId, name: m.name, imageUrl: m.imageUrl }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Opportunità</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Pipeline di vendita e kanban delle trattative</p>
        </div>
        {perms.SETTINGS !== "NONE" && <Link
          href={`/${slug}/settings/pipelines`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px]"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
        >
          <Settings className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Pipeline</span>
        </Link>}
      </div>

      <Suspense fallback={null}>
        <OpportunityFilters pipelines={pipelines} members={memberOptions} />
      </Suspense>

      {!currentPipeline ? (
        <p className="text-[13px] text-fg-3">Nessuna pipeline configurata.</p>
      ) : view === "kanban" ? (
        <KanbanBoard
          canCreateContract={perms.CONTRACTS === "EDIT" || perms.CONTRACTS === "FULL"}
          pipelines={pipelines}
          currentPipelineId={currentPipelineId}
          stages={stages}
          opportunities={opportunities}
          members={memberOptions}
          products={products}
          customFieldDefs={customFieldDefs}
          nextTaskByOpportunity={nextTaskByOpportunity}
        />
      ) : (
        <Suspense fallback={null}>
          <OpportunityListView
            pipelines={pipelines}
            currentPipelineId={currentPipelineId}
            stages={stages}
            opportunities={listOpportunities}
            members={memberOptions}
            products={products}
            customFieldDefs={customFieldDefs}
          />
        </Suspense>
      )}
    </div>
  );
}
