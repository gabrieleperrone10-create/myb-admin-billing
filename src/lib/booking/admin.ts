import "server-only";
import type { CompanyContext } from "@/lib/company";
import { listCompanyMembers } from "@/lib/crm/members";
import { REVOKED_PREFIX } from "./google";

/** Dati di contorno per il form calendario (host, pipeline, etichette, campi). */
export async function loadCalendarFormData(ctx: CompanyContext) {
  const [members, conns, pipelines, tags, customFields] = await Promise.all([
    listCompanyMembers(ctx.companyId).catch(() => []),
    ctx.db.userCalendarConnection.findMany({ where: { provider: "GOOGLE" }, select: { clerkUserId: true, lastError: true } }),
    ctx.db.pipeline.findMany({
      orderBy: { order: "asc" },
      include: { stages: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    ctx.db.crmTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    ctx.db.customFieldDef.findMany({ where: { entity: "CONTACT" }, orderBy: { order: "asc" }, select: { key: true, label: true } }),
  ]);
  return {
    members: members.map(m => ({ userId: m.userId, name: m.name, email: m.email })),
    googleHosts: conns.filter(c => !c.lastError?.startsWith(REVOKED_PREFIX)).map(c => c.clerkUserId),
    pipelines: pipelines.map(p => ({ id: p.id, name: p.name, stages: p.stages })),
    tags,
    customFields,
  };
}
