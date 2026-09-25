import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany, companyDisplayName } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { canEdit, canView, getEffectivePermissions } from "@/lib/permissions";
import { companyMailIdentity } from "@/lib/cron";
import { inboundDomainFor } from "@/lib/email/identity";
import type { EmailDomainMeta } from "@/lib/email/domains";
import EmailDomainClient from "./EmailDomainClient";

export const dynamic = "force-dynamic";

export default async function EmailDomainPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const ctx = await requireCompany(slug);
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);
  if (!canView(perms, "SETTINGS")) notFound();

  const c = ctx.company;
  const identity = companyMailIdentity(c);
  const meta = (c.emailDomainMeta ?? {}) as EmailDomainMeta;
  const inbound = inboundDomainFor(c);

  return (
    <div className="max-w-[860px] space-y-6">
      <div className="flex items-start gap-3">
        <Link href={companyPath(slug, "/settings")} className="mt-1.5" style={{ color: "var(--fg-3)" }} aria-label="Torna alle impostazioni">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Dominio email</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">
            Invia fatture, promemoria e messaggi del CRM dal dominio di {companyDisplayName(c)} e ricevi le risposte dei clienti nella scheda contatto
          </p>
        </div>
      </div>

      <EmailDomainClient
        slug={slug}
        canEdit={canEdit(perms, "SETTINGS")}
        domain={c.emailDomain}
        sendingStatus={c.emailDomainStatus}
        inboundDomain={c.inboundDomain}
        inboundStatus={c.inboundDomainStatus}
        records={meta.records ?? []}
        lastCheckedAt={meta.lastCheckedAt ?? null}
        lastError={meta.lastError ?? null}
        currentFrom={identity.fromEmail ? `${identity.fromName} <${identity.fromEmail}>` : null}
        currentFromName={c.emailFromName ?? companyDisplayName(c)}
        currentLocal={c.emailDomain && c.emailFromAddress?.toLowerCase().endsWith(`@${c.emailDomain}`) ? c.emailFromAddress.split("@")[0] : "info"}
        repliesTo={inbound}
        nextAutoCheckAt={meta.autoCheck?.nextCheckAt ?? null}
        ownersNotifiedAt={meta.autoCheck?.notifiedAt ?? null}
      />
    </div>
  );
}
