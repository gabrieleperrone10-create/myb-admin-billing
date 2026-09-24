export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import TagsManager from "@/components/crm/settings/TagsManager";

export default async function CrmTagsSettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db } = await requireCompany(slug);

  const tagsRaw = await db.crmTag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  const tags = tagsRaw.map(t => ({ id: t.id, name: t.name, color: t.color, contactCount: t._count.contacts }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={companyPath(slug, "/contacts")} style={{ color: "var(--fg-3)" }} aria-label="Torna ai contatti">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>Etichette CRM</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>Etichette per organizzare e filtrare i contatti</p>
        </div>
      </div>

      <TagsManager slug={slug} tags={tags} />
    </div>
  );
}
