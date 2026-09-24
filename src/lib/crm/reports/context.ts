import "server-only";
import { requireCompany } from "@/lib/company";
import { canEdit, canView, getEffectivePermissions } from "@/lib/permissions";
import { listCompanyMembers } from "@/lib/crm/members";
import { resolvePeriod } from "./period";
import type { ReportScope } from "./queries";

export type ReportSearchParams = {
  tab?: string;
  period?: string;
  from?: string;
  to?: string;
  pipeline?: string;
  owner?: string;
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Contesto comune alle pagine /reports: azienda, permessi, periodo (nel fuso
 * aziendale), pipeline e membri per i filtri. I parametri dell'URL sono input
 * non fidato: pipeline e responsabile valgono solo se appartengono all'azienda.
 */
export async function loadReportContext(slug: string, raw: Record<string, string | string[] | undefined>) {
  const ctx = await requireCompany(slug);
  const sp: ReportSearchParams = {
    tab: one(raw.tab), period: one(raw.period), from: one(raw.from), to: one(raw.to),
    pipeline: one(raw.pipeline), owner: one(raw.owner),
  };

  const [perms, pipelinesRaw, members] = await Promise.all([
    getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId),
    ctx.db.pipeline.findMany({
      orderBy: [{ isDefault: "desc" }, { order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    listCompanyMembers(ctx.companyId),
  ]);

  const period = resolvePeriod(sp.period, sp.from, sp.to, ctx.company.timezone || "Europe/Rome");
  const pipelineId = sp.pipeline && pipelinesRaw.some(p => p.id === sp.pipeline) ? sp.pipeline : null;
  const ownerId = sp.owner && members.some(m => m.userId === sp.owner) ? sp.owner : null;
  const scope: ReportScope = { pipelineId, ownerId };

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) query.set(k, v);

  return {
    ctx,
    canView: canView(perms, "REPORTS"),
    canEdit: canEdit(perms, "REPORTS"),
    sp,
    period,
    scope,
    pipelines: pipelinesRaw.map(p => ({ id: p.id, name: p.name })),
    defaultPipelineId: pipelinesRaw[0]?.id ?? null,
    members,
    memberOptions: members.map(m => ({ id: m.userId, name: m.name })),
    query: query.toString(),
  };
}
