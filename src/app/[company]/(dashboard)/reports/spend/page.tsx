export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { loadReportContext } from "@/lib/crm/reports/context";
import { describeRange } from "@/lib/crm/reports/period";
import { aggregateSpend, dayToStored, storedDay } from "@/lib/crm/reports/spend";
import { SOURCE_LABELS, sourceLabel } from "@/lib/crm/reports/sources";
import { fmtEur } from "@/lib/crm/reports/format";
import { ReportFilters } from "@/components/crm/reports/ReportFilters";
import { ReportTabs } from "@/components/crm/reports/ReportTabs";
import { ReportKpi } from "@/components/crm/reports/ReportKpi";
import { SpendManager, type SpendRowData } from "@/components/crm/reports/SpendManager";

/*
 * Server Component: a SpendManager (client) passa solo dati plain (date come
 * stringhe "yyyy-MM-dd"); le server action sono importate dal client stesso.
 */

export default async function SpendPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ company: slug }, raw] = await Promise.all([params, searchParams]);
  const rc = await loadReportContext(slug, raw);

  if (!rc.canView) {
    return (
      <p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>
        Non hai i permessi per vedere i report.
      </p>
    );
  }

  const { period } = rc;
  const entries = await rc.ctx.db.adSpend.findMany({
    where: { periodStart: { lte: dayToStored(period.toDay) }, periodEnd: { gte: dayToStored(period.fromDay) } },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    take: 1000,
    select: { id: true, source: true, campaign: true, periodStart: true, periodEnd: true, amount: true, notes: true },
  });

  const rows: SpendRowData[] = entries.map(e => ({
    id: e.id,
    source: e.source,
    sourceLabel: sourceLabel(e.source),
    campaign: e.campaign,
    periodStart: storedDay(e.periodStart),
    periodEnd: storedDay(e.periodEnd),
    amount: e.amount,
    notes: e.notes,
  }));

  const agg = aggregateSpend(entries, period.fromDay, period.toDay);
  const bySource = [...agg.bySource.entries()].sort((a, b) => b[1].total - a[1].total);
  const suggestions = [...new Set([...Object.keys(SOURCE_LABELS).filter(k => !["form", "booking", "import", "manual", "billing", "unknown", "whatsapp"].includes(k)), ...entries.map(e => e.source)])];

  return (
    <div className="space-y-4" style={{ maxWidth: 1280 }}>
      <div className="space-y-1">
        <h1 className="font-bold text-fg" style={{ fontSize: "clamp(20px, 5vw, 26px)", letterSpacing: "-0.025em" }}>
          Report vendite
        </h1>
        <p className="text-[13px] text-fg-3">{describeRange(period)}</p>
      </div>

      <ReportTabs slug={slug} active="spend" query={rc.query} />

      <Suspense fallback={<div style={{ height: 36 }} />}>
        <ReportFilters
          key={`${period.fromDay}_${period.toDay}`}
          preset={period.preset}
          fromDay={period.fromDay}
          toDay={period.toDay}
          pipelines={rc.pipelines}
          members={rc.memberOptions}
          pipelineId=""
          ownerId=""
          showPipeline={false}
          showOwner={false}
        />
      </Suspense>

      <div className="text-[12px] leading-relaxed rounded-[var(--r-md)] px-3 py-2.5 text-fg-2" style={{ backgroundColor: "var(--subtle)" }}>
        Registra qui quanto spendi in pubblicità per calcolare CPL, CAC e ROAS. Usa come fonte e campagna gli stessi nomi
        delle UTM (utm_source / utm_campaign) dei tuoi annunci. Se una voce copre un periodo che si sovrappone solo in
        parte a quello selezionato, nei report se ne conta la quota proporzionale ai giorni (es. 300 € dal 1 al 30
        settembre, filtro dal 21 settembre → 100 €). <strong className="text-fg">L&apos;import automatico da Meta Ads arriverà in seguito.</strong>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ReportKpi label="Spesa nel periodo" value={fmtEur(agg.total)} sub="Quota pro-rata sui giorni" muted={agg.total === 0} />
        {bySource.slice(0, 3).map(([src, s]) => (
          <ReportKpi key={src} label={sourceLabel(src)} value={fmtEur(s.total)} sub={`${[...s.byCampaign.keys()].filter(Boolean).length} campagne`} />
        ))}
      </div>

      <SpendManager
        rows={rows}
        canEdit={rc.canEdit}
        sourceSuggestions={suggestions}
        defaultStart={period.fromDay}
        defaultEnd={period.toDay}
      />
    </div>
  );
}
