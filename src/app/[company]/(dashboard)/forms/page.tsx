export const dynamic = "force-dynamic";

import Link from "next/link";
import { FileText, Plus, Copy, ExternalLink } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { ensureTrackingKey } from "@/lib/crm/tracking/key";
import { getPublicOrigin } from "@/lib/crm/tracking/origin";
import { createForm, duplicateForm, deleteForm } from "@/app/actions/forms";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";
import { TrackingSnippetCard } from "@/components/crm/forms/TrackingSnippetCard";

export default async function FormsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db, companyId } = await requireCompany(slug);

  const [forms, trackingKey, origin] = await Promise.all([
    db.form.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { submissions: true } },
        submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    ensureTrackingKey(companyId),
    getPublicOrigin(),
  ]);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Form</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Raccogli lead dal sito e collegali automaticamente al CRM.</p>
        </div>
        <form action={createForm.bind(null, slug)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)] transition-colors shrink-0"
            style={{ height: 40, minHeight: "unset" }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Nuovo form</span>
            <span className="sm:hidden">Nuovo</span>
          </button>
        </form>
      </div>

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nessun form"
          subtitle="Crea il tuo primo form per raccogliere lead dal sito"
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {forms.map((f) => (
              <Link
                key={f.id}
                href={companyPath(slug, `/forms/${f.id}`)}
                className="mobile-card flex items-center gap-3"
                style={{ minHeight: "unset" }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>
                  <FileText className="w-4.5 h-4.5" strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-fg truncate">{f.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={f.active ? "ok" : "neutral"}>{f.active ? "Attivo" : "Bozza"}</Badge>
                    <span className="text-[11px] text-fg-3">{f._count.submissions} invii</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-subtle border-b border-border">
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Nome</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Invii</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Ultimo invio</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={companyPath(slug, `/forms/${f.id}`)} className="text-[13px] font-medium text-fg hover:underline">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><Badge variant={f.active ? "ok" : "neutral"}>{f.active ? "Attivo" : "Bozza"}</Badge></td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2 tabular-nums">{f._count.submissions}</td>
                    <td className="px-4 py-2.5 text-[12px] text-fg-3">
                      {f.submissions[0] ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(f.submissions[0].createdAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        {f.active && (
                          <a
                            href={`${origin}/f/${f.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Apri
                          </a>
                        )}
                        <form action={duplicateForm.bind(null, slug, f.id)}>
                          <button type="submit" className="inline-flex items-center gap-1 text-[12px] font-medium text-fg-2 hover:underline">
                            <Copy className="w-3 h-3" /> Duplica
                          </button>
                        </form>
                        <Link href={companyPath(slug, `/forms/${f.id}`)} className="text-[12px] font-medium text-info hover:underline">
                          Modifica
                        </Link>
                        <DeleteConfirmButton
                          action={deleteForm.bind(null, slug, f.id)}
                          message={`Eliminare "${f.name}"? Gli invii ricevuti restano collegati ai contatti, ma il form non sarà più raggiungibile.`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <TrackingSnippetCard origin={origin} trackingKey={trackingKey} />
    </div>
  );
}
