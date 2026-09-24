import "server-only";
import type { CompanyDb, Prisma } from "@/lib/db";
import { bucketKey, dayOf, listBuckets, type DateRange, type Granularity, type ResolvedPeriod } from "./period";
import { aggregateSpend, dayToStored, type SpendEntry } from "./spend";
import { collectionEvents, sumByContact, type CreditNoteRow, type PaidInvoiceRow } from "./revenue";
import { computeAttribution, isCustomer, type AttributionMetrics, type SourceRow } from "./attribution";
import { computeFunnel, type FunnelResult, type FunnelStage } from "./funnel";
import { cac, cpl, deltaPct, rate, roas } from "./metrics";

/**
 * Query dei report. Tutto passa da `db` (client filtrato per azienda): nessuna
 * $queryRaw, quindi l'isolamento fra aziende e' garantito dall'estensione di
 * lib/db.ts anche sui filtri di relazione annidati (restano dentro righe della
 * stessa azienda perche' partono da una tabella gia' filtrata).
 *
 * Le aggregazioni che non hanno un equivalente groupBy (bucket per giorno nel
 * fuso aziendale, imbuto, attribuzione su JSON) si fanno in memoria sui soli
 * campi necessari, delegando i calcoli ai moduli puri testati da
 * scripts/test-reports.mts.
 */

export type ReportScope = {
  /** Filtra le opportunita' (non i lead, che non appartengono a una pipeline) */
  pipelineId: string | null;
  /** Responsabile: Contact.ownerUserId per i lead, Opportunity.ownerUserId per le opportunita', hostUserId per gli appuntamenti */
  ownerId: string | null;
};

type Range = Pick<DateRange, "from" | "to" | "fromDay" | "toDay">;

function inRange(r: Range) {
  return { gte: r.from, lt: r.to };
}

function contactWhere(r: Range, scope: ReportScope): Prisma.ContactWhereInput {
  return { createdAt: inRange(r), ...(scope.ownerId ? { ownerUserId: scope.ownerId } : {}) };
}

function oppWhere(scope: ReportScope): Prisma.OpportunityWhereInput {
  return {
    ...(scope.pipelineId ? { pipelineId: scope.pipelineId } : {}),
    ...(scope.ownerId ? { ownerUserId: scope.ownerId } : {}),
  };
}

// ─── Spesa ─────────────────────────────────────────────────────────────────

export async function loadSpendEntries(db: CompanyDb, r: Pick<DateRange, "fromDay" | "toDay">): Promise<SpendEntry[]> {
  return db.adSpend.findMany({
    where: { periodStart: { lte: dayToStored(r.toDay) }, periodEnd: { gte: dayToStored(r.fromDay) } },
    select: { source: true, campaign: true, periodStart: true, periodEnd: true, amount: true },
  });
}

// ─── Coorte (lead creati nel periodo) ──────────────────────────────────────

async function loadCohortRevenue(db: CompanyDb, cw: Prisma.ContactWhereInput) {
  const [invoices, notes] = await Promise.all([
    db.invoice.findMany({
      where: { status: "PAID", client: { contact: cw } },
      select: {
        id: true, amount: true, paidAt: true, issueDate: true,
        client: { select: { contactId: true } },
        payment: { select: { amount: true, method: true, paidAt: true } },
      },
    }),
    db.creditNote.findMany({
      where: { status: { not: "CANCELLED" }, invoice: { status: "PAID", client: { contact: cw } } },
      select: { invoiceId: true, amount: true, issueDate: true },
    }),
  ]);
  return collectionEvents(toInvoiceRows(invoices), notes as CreditNoteRow[]);
}

type InvoiceSelect = {
  id: string; amount: number; paidAt: Date | null; issueDate: Date;
  client: { contactId: string | null };
  payment: { amount: number; method: string; paidAt: Date } | null;
};

function toInvoiceRows(rows: InvoiceSelect[]): PaidInvoiceRow[] {
  return rows
    .filter(r => r.client.contactId)
    .map(r => ({ id: r.id, contactId: r.client.contactId!, amount: r.amount, paidAt: r.paidAt, issueDate: r.issueDate, payment: r.payment }));
}

export async function loadCohort(db: CompanyDb, r: Range, scope: ReportScope) {
  const cw = contactWhere(r, scope);
  const [contacts, opportunities, wonRows, events] = await Promise.all([
    db.contact.findMany({
      where: cw,
      select: { id: true, source: true, attribution: true, lifecycle: true, createdAt: true },
    }),
    db.opportunity.findMany({
      where: { contact: cw, ...(scope.pipelineId ? { pipelineId: scope.pipelineId } : {}) },
      select: { contactId: true, status: true, value: true },
    }),
    db.opportunity.findMany({
      where: { status: "WON", contact: cw },
      select: { contactId: true },
      distinct: ["contactId"],
    }),
    loadCohortRevenue(db, cw),
  ]);
  const collectedByContact = sumByContact(events);
  const wonContactIds = new Set(wonRows.map(w => w.contactId));
  const customers = contacts.filter(c => isCustomer(c, wonContactIds, collectedByContact)).length;
  const collected = [...collectedByContact.values()].reduce((s, v) => s + v, 0);
  return { contacts, opportunities, wonContactIds, collectedByContact, collected, customers };
}

// ─── KPI di periodo ─────────────────────────────────────────────────────────

export type PeriodKpis = {
  leads: number;
  opportunitiesCreated: number;
  won: number;
  lost: number;
  wonValue: number;
  /** % vinte / (vinte + perse) chiuse nel periodo */
  winRate: number | null;
  /** Incassato ad oggi dai lead creati nel periodo (coorte) */
  collected: number;
  /** Lead del periodo diventati clienti */
  customers: number;
  spend: number;
  roas: number | null;
  cpl: number | null;
  cac: number | null;
};

export async function getPeriodKpis(db: CompanyDb, r: Range, scope: ReportScope): Promise<PeriodKpis> {
  const ow = oppWhere(scope);
  const [leads, opportunitiesCreated, wonAgg, lost, cohort, spendEntries] = await Promise.all([
    db.contact.count({ where: contactWhere(r, scope) }),
    db.opportunity.count({ where: { ...ow, createdAt: inRange(r) } }),
    db.opportunity.aggregate({ where: { ...ow, status: "WON", closedAt: inRange(r) }, _count: { _all: true }, _sum: { value: true } }),
    db.opportunity.count({ where: { ...ow, status: "LOST", closedAt: inRange(r) } }),
    loadCohortTotals(db, r, scope),
    loadSpendEntries(db, r),
  ]);
  const spend = aggregateSpend(spendEntries, r.fromDay, r.toDay).total;
  const won = wonAgg._count._all;
  return {
    leads,
    opportunitiesCreated,
    won,
    lost,
    wonValue: wonAgg._sum.value ?? 0,
    winRate: rate(won, won + lost),
    collected: cohort.collected,
    customers: cohort.customers,
    spend,
    roas: roas(cohort.collected, spend),
    cpl: cpl(spend, leads),
    cac: cac(spend, cohort.customers),
  };
}

/** Come loadCohort ma senza caricare il JSON di attribuzione (solo totali). */
async function loadCohortTotals(db: CompanyDb, r: Range, scope: ReportScope) {
  const cw = contactWhere(r, scope);
  const [contacts, wonRows, events] = await Promise.all([
    db.contact.findMany({ where: cw, select: { id: true, lifecycle: true } }),
    db.opportunity.findMany({ where: { status: "WON", contact: cw }, select: { contactId: true }, distinct: ["contactId"] }),
    loadCohortRevenue(db, cw),
  ]);
  const byContact = sumByContact(events);
  const wonIds = new Set(wonRows.map(w => w.contactId));
  let customers = 0;
  for (const c of contacts) {
    if (c.lifecycle === "CUSTOMER" || wonIds.has(c.id) || (byContact.get(c.id) ?? 0) > 0) customers++;
  }
  return { collected: [...byContact.values()].reduce((s, v) => s + v, 0), customers };
}

/**
 * Riepilogo vendite per la dashboard principale.
 * `from` incluso, `to` ESCLUSO (istanti). `timezone` serve a trasformare il
 * periodo in giorni di calendario per ripartire la spesa ads.
 * I KPI sono quelli della tab Panoramica, senza filtri pipeline/responsabile.
 */
export async function getSalesSummary(
  db: CompanyDb,
  companyId: string,
  { from, to, timezone = "Europe/Rome" }: { from: Date; to: Date; timezone?: string },
): Promise<PeriodKpis> {
  void companyId; // l'isolamento e' gia' in `db`; il parametro resta per le future query raw
  const range: Range = { from, to, fromDay: dayOf(from, timezone), toDay: dayOf(new Date(to.getTime() - 1), timezone) };
  return getPeriodKpis(db, range, { pipelineId: null, ownerId: null });
}

// ─── Panoramica ─────────────────────────────────────────────────────────────

export type TrendPoint = { key: string; label: string; leads: number; won: number; collected: number };

export type OverviewData = {
  current: PeriodKpis;
  previous: PeriodKpis;
  deltas: Record<keyof PeriodKpis, number | null>;
  trend: TrendPoint[];
  granularity: Granularity;
  /** Incassato nel periodo per data di pagamento (tutti i clienti collegati al CRM) */
  collectedByDate: number;
};

export async function getOverview(db: CompanyDb, p: ResolvedPeriod, scope: ReportScope): Promise<OverviewData> {
  const [current, previous, trendData] = await Promise.all([
    getPeriodKpis(db, p, scope),
    getPeriodKpis(db, p.previous, scope),
    loadTrend(db, p, scope),
  ]);
  const deltas = Object.fromEntries(
    (Object.keys(current) as (keyof PeriodKpis)[]).map(k => [k, deltaPct(current[k], previous[k])]),
  ) as Record<keyof PeriodKpis, number | null>;
  return { current, previous, deltas, trend: trendData.points, granularity: p.granularity, collectedByDate: trendData.collected };
}

async function loadTrend(db: CompanyDb, p: ResolvedPeriod, scope: ReportScope) {
  const tz = p.timezone;
  const ow = oppWhere(scope);
  const crmClient: Prisma.ClientWhereInput = scope.ownerId
    ? { contact: { ownerUserId: scope.ownerId } }
    : { contactId: { not: null } };
  const r = inRange(p);

  const [leads, wins, invoices] = await Promise.all([
    db.contact.findMany({ where: contactWhere(p, scope), select: { createdAt: true } }),
    db.opportunity.findMany({ where: { ...ow, status: "WON", closedAt: r }, select: { closedAt: true } }),
    db.invoice.findMany({
      where: {
        status: "PAID",
        client: crmClient,
        OR: [
          { paidAt: r },
          { payment: { paidAt: r } },
          { paidAt: null, issueDate: r },
          { creditNotes: { some: { status: { not: "CANCELLED" }, issueDate: r } } },
        ],
      },
      select: {
        id: true, amount: true, paidAt: true, issueDate: true,
        client: { select: { contactId: true } },
        payment: { select: { amount: true, method: true, paidAt: true } },
      },
    }),
  ]);
  const notes = invoices.length
    ? await db.creditNote.findMany({
        where: { status: { not: "CANCELLED" }, invoiceId: { in: invoices.map(i => i.id) } },
        select: { invoiceId: true, amount: true, issueDate: true },
      })
    : [];
  const events = collectionEvents(toInvoiceRows(invoices), notes).filter(e => e.at >= p.from && e.at < p.to);

  const buckets = listBuckets(p, p.granularity);
  const map = new Map<string, TrendPoint>(buckets.map(b => [b.key, { key: b.key, label: b.label, leads: 0, won: 0, collected: 0 }]));
  const bucketOf = (d: Date) => map.get(bucketKey(dayOf(d, tz), p.granularity));
  for (const l of leads) { const b = bucketOf(l.createdAt); if (b) b.leads++; }
  for (const w of wins) { if (w.closedAt) { const b = bucketOf(w.closedAt); if (b) b.won++; } }
  let collected = 0;
  for (const e of events) {
    collected += e.amount;
    const b = bucketOf(e.at);
    if (b) b.collected += e.amount;
  }
  const points = buckets.map(b => {
    const pt = map.get(b.key)!;
    return { ...pt, collected: Math.round(pt.collected * 100) / 100 };
  });
  return { points, collected };
}

// ─── Imbuto ─────────────────────────────────────────────────────────────────

export type FunnelData = FunnelResult & { pipelineName: string };

export async function getFunnel(db: CompanyDb, p: Range, scope: ReportScope, pipelineId: string): Promise<FunnelData | null> {
  const pipeline = await db.pipeline.findUnique({
    where: { id: pipelineId },
    select: { name: true, stages: { select: { id: true, name: true, order: true, kind: true, color: true } } },
  });
  if (!pipeline) return null;
  const opps = await db.opportunity.findMany({
    where: { pipelineId, createdAt: inRange(p), ...(scope.ownerId ? { ownerUserId: scope.ownerId } : {}) },
    select: {
      id: true, status: true, stageId: true, createdAt: true, closedAt: true, lostReason: true,
      stageChanges: { select: { fromStageId: true, toStageId: true, changedAt: true }, orderBy: { changedAt: "asc" } },
    },
  });
  const result = computeFunnel(
    pipeline.stages as FunnelStage[],
    opps.map(o => ({ ...o, changes: o.stageChanges })),
  );
  return { ...result, pipelineName: pipeline.name };
}

// ─── Attribuzione ─────────────────────────────────────────────────────────

export type AttributionData = { rows: SourceRow[]; totals: AttributionMetrics };

export async function getAttribution(db: CompanyDb, p: Range, scope: ReportScope): Promise<AttributionData> {
  const [cohort, spendEntries] = await Promise.all([loadCohort(db, p, scope), loadSpendEntries(db, p)]);
  return computeAttribution({
    contacts: cohort.contacts,
    opportunities: cohort.opportunities,
    wonContactIds: cohort.wonContactIds,
    collectedByContact: cohort.collectedByContact,
    spend: aggregateSpend(spendEntries, p.fromDay, p.toDay),
  });
}

// ─── Team ─────────────────────────────────────────────────────────────────

export type TeamRow = {
  userId: string | null;
  leads: number;
  won: number;
  lost: number;
  wonValue: number;
  winRate: number | null;
  appointmentsCompleted: number;
  appointmentsNoShow: number;
  showRate: number | null;
  /** giorni medi fra creazione e chiusura delle opportunita' vinte nel periodo */
  avgDaysToClose: number | null;
};

export async function getTeam(db: CompanyDb, p: Range, scope: ReportScope): Promise<TeamRow[]> {
  const ow = oppWhere(scope);
  const r = inRange(p);
  const [leadGroups, closedOpps, apptGroups] = await Promise.all([
    db.contact.groupBy({ by: ["ownerUserId"], where: contactWhere(p, scope), _count: { _all: true } }),
    db.opportunity.findMany({
      where: { ...ow, status: { in: ["WON", "LOST"] }, closedAt: r },
      select: { ownerUserId: true, status: true, value: true, createdAt: true, closedAt: true },
    }),
    db.appointment.groupBy({
      by: ["hostUserId", "status"],
      where: { startTime: r, status: { in: ["COMPLETED", "NO_SHOW"] }, ...(scope.ownerId ? { hostUserId: scope.ownerId } : {}) },
      _count: { _all: true },
    }),
  ]);

  const rows = new Map<string, TeamRow & { closeMs: number; closeN: number }>();
  const get = (id: string | null) => {
    const k = id ?? "";
    let row = rows.get(k);
    if (!row) {
      row = { userId: id, leads: 0, won: 0, lost: 0, wonValue: 0, winRate: null, appointmentsCompleted: 0, appointmentsNoShow: 0, showRate: null, avgDaysToClose: null, closeMs: 0, closeN: 0 };
      rows.set(k, row);
    }
    return row;
  };
  for (const g of leadGroups) get(g.ownerUserId).leads += g._count._all;
  for (const o of closedOpps) {
    const row = get(o.ownerUserId);
    if (o.status === "WON") {
      row.won++;
      row.wonValue += o.value || 0;
      if (o.closedAt) { row.closeMs += Math.max(0, o.closedAt.getTime() - o.createdAt.getTime()); row.closeN++; }
    } else row.lost++;
  }
  for (const g of apptGroups) {
    const row = get(g.hostUserId);
    if (g.status === "COMPLETED") row.appointmentsCompleted += g._count._all;
    else row.appointmentsNoShow += g._count._all;
  }
  return [...rows.values()]
    .map(({ closeMs, closeN, ...row }) => ({
      ...row,
      winRate: rate(row.won, row.won + row.lost),
      showRate: rate(row.appointmentsCompleted, row.appointmentsCompleted + row.appointmentsNoShow),
      avgDaysToClose: closeN > 0 ? closeMs / closeN / 86_400_000 : null,
    }))
    .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won || b.leads - a.leads);
}

// ─── Appuntamenti ─────────────────────────────────────────────────────────

export type AppointmentCounts = {
  booked: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** SCHEDULED/CONFIRMED gia' passati: esito non registrato */
  pending: number;
  upcoming: number;
  showRate: number | null;
};

export type AppointmentsData = {
  totals: AppointmentCounts;
  byCalendar: (AppointmentCounts & { id: string; name: string; color: string })[];
  byHost: (AppointmentCounts & { userId: string })[];
};

function emptyCounts(): AppointmentCounts {
  return { booked: 0, completed: 0, noShow: 0, cancelled: 0, pending: 0, upcoming: 0, showRate: null };
}

export async function getAppointments(db: CompanyDb, p: Range, scope: ReportScope, now = new Date()): Promise<AppointmentsData> {
  const where: Prisma.AppointmentWhereInput = {
    startTime: inRange(p),
    ...(scope.ownerId ? { hostUserId: scope.ownerId } : {}),
  };
  const [past, future, calendars] = await Promise.all([
    db.appointment.groupBy({ by: ["calendarId", "hostUserId", "status"], where: { ...where, startTime: { gte: p.from, lt: minDate(p.to, now) } }, _count: { _all: true } }),
    db.appointment.groupBy({ by: ["calendarId", "hostUserId", "status"], where: { ...where, startTime: { gte: maxDate(p.from, now), lt: p.to } }, _count: { _all: true } }),
    db.calendar.findMany({ select: { id: true, name: true, color: true } }),
  ]);

  const totals = emptyCounts();
  const byCal = new Map<string, AppointmentCounts>();
  const byHost = new Map<string, AppointmentCounts>();
  const bump = (c: AppointmentCounts, status: string, n: number, isPast: boolean) => {
    c.booked += n;
    if (status === "COMPLETED") c.completed += n;
    else if (status === "NO_SHOW") c.noShow += n;
    else if (status === "CANCELLED") c.cancelled += n;
    else if (isPast) c.pending += n;
    else c.upcoming += n;
  };
  for (const [groups, isPast] of [[past, true], [future, false]] as const) {
    for (const g of groups) {
      const n = g._count._all;
      bump(totals, g.status, n, isPast);
      if (!byCal.has(g.calendarId)) byCal.set(g.calendarId, emptyCounts());
      bump(byCal.get(g.calendarId)!, g.status, n, isPast);
      if (!byHost.has(g.hostUserId)) byHost.set(g.hostUserId, emptyCounts());
      bump(byHost.get(g.hostUserId)!, g.status, n, isPast);
    }
  }
  const finish = <T extends AppointmentCounts>(c: T): T => ({ ...c, showRate: rate(c.completed, c.completed + c.noShow) });
  const calInfo = new Map(calendars.map(c => [c.id, c]));
  return {
    totals: finish(totals),
    byCalendar: [...byCal.entries()]
      .map(([id, c]) => finish({ ...c, id, name: calInfo.get(id)?.name ?? "Calendario eliminato", color: calInfo.get(id)?.color ?? "#94a3b8" }))
      .sort((a, b) => b.booked - a.booked),
    byHost: [...byHost.entries()].map(([userId, c]) => finish({ ...c, userId })).sort((a, b) => b.booked - a.booked),
  };
}

function minDate(a: Date, b: Date) { return a < b ? a : b; }
function maxDate(a: Date, b: Date) { return a > b ? a : b; }
