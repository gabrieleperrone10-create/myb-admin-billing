import { requireCompany } from "@/lib/company";
import { listCompanyMembers } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import type { ContactTabProps } from "./types";
import { OpportunitiesTabClient } from "./OpportunitiesTabClient";
import type { OpportunityCardData } from "@/components/crm/opportunities/types";

// Proprietario: agente D — opportunità del contatto
export default async function OpportunitiesTab({ slug, contactId }: ContactTabProps) {
  const { db, companyId } = await requireCompany(slug);

  const [contact, rows, pipelinesRaw, members, products, customFieldDefsRaw] = await Promise.all([
    db.contact.findUnique({ where: { id: contactId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } }),
    db.opportunity.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      include: {
        stage: { select: { id: true, name: true, color: true, kind: true } },
        pipeline: { select: { id: true, name: true } },
        product: { select: { name: true } },
        stageChanges: {
          orderBy: { changedAt: "desc" },
          include: { fromStage: { select: { name: true } }, toStage: { select: { name: true } } },
        },
      },
    }),
    db.pipeline.findMany({ orderBy: [{ isDefault: "desc" }, { order: "asc" }], include: { stages: { orderBy: { order: "asc" } } } }),
    listCompanyMembers(companyId),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, basePrice: true } }),
    db.customFieldDef.findMany({ where: { entity: "OPPORTUNITY" }, orderBy: { order: "asc" } }),
  ]);

  if (!contact) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>Contatto non trovato</p>;

  const pipelines = pipelinesRaw.map(p => ({
    id: p.id, name: p.name, isDefault: p.isDefault,
    stages: p.stages.map(s => ({ id: s.id, name: s.name, order: s.order, kind: s.kind, probability: s.probability, color: s.color })),
  }));
  const customFieldDefs = customFieldDefsRaw.map(d => ({
    id: d.id, key: d.key, label: d.label, type: d.type, required: d.required,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
  }));
  const memberOptions = members.map(m => ({ userId: m.userId, name: m.name, imageUrl: m.imageUrl }));

  const opportunities: (OpportunityCardData & {
    stageName: string; stageColor: string; pipelineName: string;
    stageChanges: { id: string; changedAt: string; fromStage: string | null; toStage: string }[];
  })[] = rows.map(o => ({
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
    contact: { id: contact.id, name: contactDisplayName(contact), email: contact.email, companyName: contact.companyName },
    stageName: o.stage.name,
    stageColor: o.stage.color,
    pipelineName: o.pipeline.name,
    stageChanges: o.stageChanges.map(c => ({
      id: c.id,
      changedAt: c.changedAt.toISOString(),
      fromStage: c.fromStage?.name ?? null,
      toStage: c.toStage.name,
    })),
  }));

  return (
    <OpportunitiesTabClient
      slug={slug}
      contact={{ id: contact.id, name: contactDisplayName(contact), email: contact.email, companyName: contact.companyName }}
      opportunities={opportunities}
      pipelines={pipelines}
      members={memberOptions}
      products={products}
      customFieldDefs={customFieldDefs}
    />
  );
}
