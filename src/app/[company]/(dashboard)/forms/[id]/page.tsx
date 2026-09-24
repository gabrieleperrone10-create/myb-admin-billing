export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/company";
import { ensureDefaultPipeline } from "@/lib/crm/pipelines";
import { ensureTrackingKey } from "@/lib/crm/tracking/key";
import { getPublicOrigin } from "@/lib/crm/tracking/origin";
import { listCompanyMembers } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import type { FormField, FormSettings } from "@/lib/crm/types";
import { FormEditor } from "@/components/crm/forms/FormEditor";

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ company: string; id: string }>;
}) {
  const { company: slug, id } = await params;
  const { db, companyId } = await requireCompany(slug);

  const form = await db.form.findUnique({ where: { id } });
  if (!form) notFound();

  // Garantisce che ci sia sempre almeno una pipeline selezionabile, anche per
  // le aziende che non hanno ancora aperto il kanban.
  await ensureDefaultPipeline(db, companyId);

  const [pipelines, tags, members, customFieldDefs, submissions, submissionCount, trackingKey, origin] = await Promise.all([
    db.pipeline.findMany({
      orderBy: { order: "asc" },
      include: { stages: { orderBy: { order: "asc" } } },
    }),
    db.crmTag.findMany({ orderBy: { name: "asc" } }),
    listCompanyMembers(companyId),
    db.customFieldDef.findMany({ where: { entity: "CONTACT" }, orderBy: { order: "asc" } }),
    db.formSubmission.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } } },
    }),
    db.formSubmission.count({ where: { formId: id } }),
    ensureTrackingKey(companyId),
    getPublicOrigin(),
  ]);

  return (
    <FormEditor
      slug={slug}
      formId={form.id}
      initialName={form.name}
      initialActive={form.active}
      initialFields={(form.fields ?? []) as unknown as FormField[]}
      initialSettings={(form.settings ?? {}) as unknown as FormSettings}
      pipelines={pipelines.map(p => ({
        id: p.id,
        name: p.name,
        stages: p.stages.map(s => ({ id: s.id, name: s.name })),
      }))}
      tags={tags.map(t => ({ id: t.id, name: t.name, color: t.color }))}
      members={members.map(m => ({ userId: m.userId, name: m.name }))}
      customFieldDefs={customFieldDefs.map(d => ({
        key: d.key,
        label: d.label,
        type: d.type,
        options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
        required: d.required,
      }))}
      submissions={submissions.map(s => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        contactId: s.contact?.id ?? null,
        contactName: s.contact ? contactDisplayName(s.contact) : null,
        data: s.data as Record<string, unknown>,
      }))}
      submissionCount={submissionCount}
      trackingKey={trackingKey}
      origin={origin}
    />
  );
}
