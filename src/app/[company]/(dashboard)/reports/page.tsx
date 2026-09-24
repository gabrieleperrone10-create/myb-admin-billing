export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { memberName } from "@/lib/crm/members";
import { companyPath } from "@/lib/paths";
import { loadReportContext } from "@/lib/crm/reports/context";
import { describeRange } from "@/lib/crm/reports/period";
import { fmtEur, fmtInt, fmtPct, fmtRoas } from "@/lib/crm/reports/format";
import { getAppointments, getAttribution, getFunnel, getOverview, getTeam } from "@/lib/crm/reports/queries";
import { ReportFilters } from "@/components/crm/reports/ReportFilters";
import { ReportTabs, parseTab } from "@/components/crm/reports/ReportTabs";
import { ReportKpi } from "@/components/crm/reports/ReportKpi";
import { TrendCharts } from "@/components/crm/reports/TrendCharts";
import { FunnelView } from "@/components/crm/reports/FunnelView";
import { AttributionTable } from "@/components/crm/reports/AttributionTable";
import { TeamView, type TeamRowView } from "@/components/crm/reports/TeamView";
import { AppointmentsView } from "@/components/crm/reports/AppointmentsView";
import { REPORT_VIZ_CSS } from "@/components/crm/reports/vizTheme";

/*
 * Server Component: ai Client Component (ReportFilters, TrendCharts,
 * AttributionTable) passa SOLO dati serializzabili — stringhe, numeri, array
 * di oggetti plain. Nessuna funzione, formatter o callback attraversa il confine.
 */

const GRANULARITY_LABEL = { day: "giornalieri", week: "settimanali", month: "mensili" } as const;

export default async function ReportsPage({
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

  const tab = parseTab(rc.sp.tab);
  if (tab === "spend") {
    const q = new URLSearchParams(rc.query);
    q.delete("tab");
    redirect(`${companyPath(slug, "/reports/spend")}${q.size ? `?${q}` : ""}`);
  }

  const { ctx, period, scope } = rc;
  const funnelPipelineId = scope.pipelineId ?? rc.defaultPipelineId;

  return (
    <div className="rep-viz space-y-4" style={{ maxWidth: 1280 }}>
      <style>{REPORT_VIZ_CSS}</style>

      <div className="space-y-1">
        <h1 className="font-bold text-fg" style={{ fontSize: "clamp(20px, 5vw, 26px)", letterSpacing: "-0.025em" }}>
          Report vendite
        </h1>
        <p className="text-[13px] text-fg-3">
          {describeRange(period)} · confronto con {describeRange(period.previous)}
        </p>
      </div>

      <ReportTabs slug={slug} active={tab} query={rc.query} />

      <Suspense fallback={<div style={{ height: 36 }} />}>
        <ReportFilters
          key={`${period.fromDay}_${period.toDay}`}
          preset={period.preset}
          fromDay={period.fromDay}
          toDay={period.toDay}
          pipelines={rc.pipelines}
          members={rc.memberOptions}
          pipelineId={tab === "funnel" ? (funnelPipelineId ?? "") : (scope.pipelineId ?? "")}
          ownerId={scope.ownerId ?? ""}
          showPipeline={tab !== "appointments"}
          allPipelinesLabel={tab === "funnel" ? null : "Tutte"}
          includeStripe={tab === "appointments" ? undefined : scope.includeStripe}
        />
      </Suspense>

      {tab === "overview" && <OverviewTab rc={rc} />}

      {tab === "funnel" && (
        funnelPipelineId
          ? <FunnelTab db={ctx.db} period={period} scope={scope} pipelineId={funnelPipelineId} />
          : <Empty text="Nessuna pipeline configurata." />
      )}

      {tab === "attribution" && <AttributionTab rc={rc} />}

      {tab === "team" && <TeamTab rc={rc} />}

      {tab === "appointments" && <AppointmentsTab rc={rc} />}
    </div>
  );
}

type Rc = Awaited<ReturnType<typeof loadReportContext>>;

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] py-10 text-center text-fg-3">{text}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] leading-relaxed rounded-[var(--r-md)] px-3 py-2.5 text-fg-2" style={{ backgroundColor: "var(--subtle)" }}>
      {children}
    </div>
  );
}

// ─── Panoramica ─────────────────────────────────────────────────────────────

async function OverviewTab({ rc }: { rc: Rc }) {
  const data = await getOverview(rc.ctx.db, rc.period, rc.scope);
  const { current: c, previous: p, deltas: d } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <ReportKpi label="Nuovi lead" value={fmtInt(c.leads)} delta={d.leads} sub={`Prima: ${fmtInt(p.leads)}`} muted={c.leads === 0} />
        <ReportKpi label="Opportunità create" value={fmtInt(c.opportunitiesCreated)} delta={d.opportunitiesCreated} sub={`Prima: ${fmtInt(p.opportunitiesCreated)}`} muted={c.opportunitiesCreated === 0} />
        <ReportKpi label="Vinte" value={fmtInt(c.won)} delta={d.won} sub={`${fmtInt(c.lost)} perse · prima ${fmtInt(p.won)} vinte`} muted={c.won === 0} />
        <ReportKpi label="Tasso di vittoria" value={fmtPct(c.winRate)} delta={d.winRate} sub={`Prima: ${fmtPct(p.winRate)}`} muted={c.winRate === null} />
        <ReportKpi label="Valore vinto" value={fmtEur(c.wonValue)} delta={d.wonValue} sub={`Prima: ${fmtEur(p.wonValue)}`} muted={c.wonValue === 0} />
        <ReportKpi label="Incassato" value={fmtEur(c.collected)} delta={d.collected} sub={`Dai lead del periodo · ${fmtInt(c.customers)} clienti`} muted={c.collected === 0} />
        <ReportKpi label="Spesa ads" value={fmtEur(c.spend)} delta={d.spend} goodWhen="neutral" sub={`Prima: ${fmtEur(p.spend)}`} muted={c.spend === 0} />
        <ReportKpi label="ROAS" value={fmtRoas(c.roas)} delta={d.roas} sub={c.spend > 0 ? "Incassato / spesa" : "Nessuna spesa registrata"} muted={c.roas === null} />
        <ReportKpi label="CPL" value={fmtEur(c.cpl)} delta={d.cpl} goodWhen="down" sub="Spesa / nuovi lead" muted={c.cpl === null} />
        <ReportKpi label="CAC" value={fmtEur(c.cac)} delta={d.cac} goodWhen="down" sub="Spesa / clienti acquisiti" muted={c.cac === null} />
      </div>

      <TrendCharts points={data.trend} granularityLabel={GRANULARITY_LABEL[data.granularity]} />

      <Note>
        <strong className="text-fg">Come leggere i numeri.</strong> L&apos;<em>incassato</em> dei KPI è quanto hanno pagato ad oggi i
        lead creati nel periodo (fatture pagate, al netto delle note di credito che le stornano; i pagamenti Stripe contano solo con
        &quot;Includi pagamenti Stripe&quot; attivo: disattivalo per i funnel in cui Stripe è solo denaro di passaggio). ROAS = incassato / spesa; CPL = spesa / nuovi lead; CAC = spesa / lead diventati clienti.
        La spesa di voci a cavallo del periodo è ripartita in proporzione ai giorni. Le variazioni % confrontano con il
        periodo precedente di pari durata: per i periodi recenti l&apos;incassato può ancora crescere.
        {rc.scope.ownerId && " Con il filtro responsabile attivo la spesa resta quella totale (non è assegnabile a una persona)."}
        {rc.scope.pipelineId && " Il filtro pipeline si applica alle opportunità, non ai lead né all'incassato."}
      </Note>
    </div>
  );
}

// ─── Imbuto ─────────────────────────────────────────────────────────────────

async function FunnelTab({ db, period, scope, pipelineId }: {
  db: Rc["ctx"]["db"]; period: Rc["period"]; scope: Rc["scope"]; pipelineId: string;
}) {
  const f = await getFunnel(db, period, scope, pipelineId);
  if (!f) return <Empty text="Pipeline non trovata." />;
  return (
    <FunnelView
      pipelineName={f.pipelineName}
      steps={f.steps}
      total={f.total}
      won={f.won}
      lost={f.lost}
      open={f.open}
      winRate={f.winRate}
      lostReasons={f.lostReasons}
    />
  );
}

// ─── Attribuzione ─────────────────────────────────────────────────────────

async function AttributionTab({ rc }: { rc: Rc }) {
  const data = await getAttribution(rc.ctx.db, rc.period, rc.scope);
  return (
    <div className="space-y-4">
      <Note>
        <strong className="text-fg">Modello first-touch.</strong> Ogni lead è attribuito alla <em>prima</em> fonte con cui è
        arrivato (utm_source e utm_campaign registrati alla prima identificazione; senza UTM valgono gclid → Google,
        fbclid → Meta, altrimenti l&apos;origine del contatto: form, prenotazione, WhatsApp, import…). Facebook, Instagram,
        fb e ig sono raggruppati in «Meta». Si considerano i lead creati nel periodo e tutto ciò che hanno prodotto
        finora (opportunità, vinte, incassato). La spesa è quella del periodo, ripartita pro-rata sui giorni; la spesa
        senza campagna finisce nella riga «(nessuna campagna)» della sua fonte.
      </Note>
      <AttributionTable rows={data.rows} totals={data.totals} fileName={`attribuzione_${rc.period.fromDay}_${rc.period.toDay}.csv`} />
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────

async function TeamTab({ rc }: { rc: Rc }) {
  const rows = await getTeam(rc.ctx.db, rc.period, rc.scope);
  const view: TeamRowView[] = rows.map(r => ({
    key: r.userId ?? "__none",
    name: r.userId ? (memberName(rc.members, r.userId) ?? "Utente non più nel team") : "Non assegnato",
    leads: r.leads,
    won: r.won,
    lost: r.lost,
    wonValue: r.wonValue,
    winRate: r.winRate,
    appointmentsCompleted: r.appointmentsCompleted,
    appointmentsNoShow: r.appointmentsNoShow,
    showRate: r.showRate,
    avgDaysToClose: r.avgDaysToClose,
  }));
  return <TeamView rows={view} />;
}

// ─── Appuntamenti ─────────────────────────────────────────────────────────

async function AppointmentsTab({ rc }: { rc: Rc }) {
  const data = await getAppointments(rc.ctx.db, rc.period, rc.scope);
  return (
    <AppointmentsView
      totals={data.totals}
      byCalendar={data.byCalendar.map(({ id, name, color, ...c }) => ({ ...c, key: id, name, color }))}
      byHost={data.byHost.map(({ userId, ...c }) => ({ ...c, key: userId, name: memberName(rc.members, userId) ?? "Utente non più nel team" }))}
    />
  );
}
