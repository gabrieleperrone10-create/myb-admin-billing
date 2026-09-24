export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import FieldsManager from "@/components/crm/settings/FieldsManager";
import type { CustomFieldDefLite } from "@/components/crm/contacts/types";

export default async function CrmFieldsSettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db } = await requireCompany(slug);

  const defsRaw = await db.customFieldDef.findMany({ orderBy: [{ entity: "asc" }, { order: "asc" }] });

  const toLite = (d: (typeof defsRaw)[number]): CustomFieldDefLite => ({
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
    required: d.required,
    order: d.order,
  });

  const contactFields = defsRaw.filter(d => d.entity === "CONTACT").map(toLite);
  const opportunityFields = defsRaw.filter(d => d.entity === "OPPORTUNITY").map(toLite);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={companyPath(slug, "/contacts")} style={{ color: "var(--fg-3)" }} aria-label="Torna ai contatti">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>Campi personalizzati CRM</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>Campi aggiuntivi per contatti e opportunità</p>
        </div>
      </div>

      <FieldsManager slug={slug} contactFields={contactFields} opportunityFields={opportunityFields} />
    </div>
  );
}
