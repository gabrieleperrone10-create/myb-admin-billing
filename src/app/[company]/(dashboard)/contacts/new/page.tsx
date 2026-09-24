export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { listCompanyMembers } from "@/lib/crm/members";
import NewContactForm from "@/components/crm/contacts/NewContactForm";
import type { CustomFieldDefLite } from "@/components/crm/contacts/types";

export default async function NewContactPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db, companyId } = await requireCompany(slug);

  const [customFieldDefsRaw, crmTagsRaw, members] = await Promise.all([
    db.customFieldDef.findMany({ where: { entity: "CONTACT" }, orderBy: { order: "asc" } }),
    db.crmTag.findMany({ orderBy: { name: "asc" } }),
    listCompanyMembers(companyId),
  ]);

  const customFieldDefs: CustomFieldDefLite[] = customFieldDefsRaw.map(d => ({
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
    required: d.required,
    order: d.order,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={companyPath(slug, "/contacts")} style={{ color: "var(--fg-3)" }} aria-label="Torna ai contatti">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>Nuovo contatto</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>Aggiungi un lead o un cliente alla rubrica CRM</p>
        </div>
      </div>

      <NewContactForm
        slug={slug}
        members={members.map(m => ({ userId: m.userId, name: m.name }))}
        tags={crmTagsRaw.map(t => ({ id: t.id, name: t.name, color: t.color }))}
        customFieldDefs={customFieldDefs}
      />
    </div>
  );
}
