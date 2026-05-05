import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { KpiCard } from "@/components/ui/KpiCard";
import PeriodFilter from "./PeriodFilter";
import TrendChart from "./TrendChart";

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  ok:     "#3b9e6a",
  warn:   "#c78b2a",
  danger: "#dc4040",
  info:   "#4f7deb",
  fg:     "oklch(0.18 0.005 80)",
  fg2:    "oklch(0.45 0.005 80)",
  fg3:    "oklch(0.62 0.005 80)",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDateRange(period: string, from?: string, to?: string) {
  const now = new Date();
  switch (period) {
    case "day":  { const s = new Date(now); s.setHours(0,0,0,0); return { start: s, end: now }; }
    case "week": { const s = new Date(now); s.setDate(s.getDate()-(s.getDay()===0?6:s.getDay()-1)); s.setHours(0,0,0,0); return { start: s, end: now }; }
    case "year":   return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case "all":    return { start: new Date("2018-01-01"), end: now };
    case "custom": return { start: from ? new Date(from) : new Date("2018-01-01"), end: to ? new Date(to+"T23:59:59") : now };
    default:       return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
}

function fillMonths(
  revRaw: { period: string; total: number }[],
  expRaw: { period: string; total: number }[],
  start: Date,
  end: Date,
) {
  const revMap = new Map(revRaw.map(r => [r.period, Number(r.total)]));
  const expMap = new Map(expRaw.map(r => [r.period, Number(r.total)]));
  const result: { period: string; label: string; amount: number; expenses: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}`;
    result.push({
      period:   key,
      label:    cur.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      amount:   revMap.get(key) ?? 0,
      expenses: expMap.get(key) ?? 0,
    });
    cur.setMonth(cur.getMonth()+1);
  }
  return result;
}

function fillDays(raw: { period: string; total: number }[], days: number) {
  const map = new Map(raw.map(r => [r.period, Number(r.total)]));
  const result: { period: string; label: string; amount: number; expenses: number }[] = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    result.push({ period: key, label: d.toLocaleDateString("it-IT",{day:"numeric",month:"short"}), amount: map.get(key) ?? 0, expenses: 0 });
  }
  return result;
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n/1000).toFixed(1).replace(".0","").replace(",0","")}k €`;
  return `${n.toFixed(0)} €`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function getData(period: string, from?: string, to?: string) {
  const { start, end } = getDateRange(period, from, to);

  const duration  = end.getTime() - start.getTime();
  const prevEnd   = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);

  const chart12Start = new Date();
  chart12Start.setMonth(chart12Start.getMonth() - 11);
  chart12Start.setDate(1);
  chart12Start.setHours(0,0,0,0);

  const chart30Start = new Date();
  chart30Start.setDate(chart30Start.getDate() - 30);
  chart30Start.setHours(0,0,0,0);

  const [
    periodRev, prevRev,
    periodExp, prevExp,
    overdueInvoices, pendingInvoices,
    periodInvoices,
    monthly12RevRaw, monthly12ExpRaw,
    daily30Raw,
    methodRaw, statusRaw,
    activeContracts,
    expByCategoryRaw,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { paidAt: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),

    prisma.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),

    prisma.invoice.findMany({ where: { status: "OVERDUE" }, include: { client: true }, orderBy: { dueDate: "asc" } }),
    prisma.invoice.aggregate({ where: { status: "SENT" }, _sum: { amount: true }, _count: true }),
    prisma.invoice.aggregate({ where: { issueDate: { gte: start, lte: end } }, _sum: { amount: true }, _count: true }),

    prisma.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR("paidAt",'YYYY-MM') as period, SUM(amount) as total
      FROM "Payment" WHERE "paidAt">=${chart12Start}
      GROUP BY period ORDER BY period`,

    prisma.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR(date,'YYYY-MM') as period, SUM(amount) as total
      FROM "Expense" WHERE date>=${chart12Start}
      GROUP BY period ORDER BY period`,

    prisma.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR("paidAt",'YYYY-MM-DD') as period, SUM(amount) as total
      FROM "Payment" WHERE "paidAt">=${chart30Start}
      GROUP BY period ORDER BY period`,

    prisma.$queryRaw<{ method: string; total: number }[]>`
      SELECT method, SUM(amount) as total FROM "Payment"
      WHERE "paidAt">=${start} AND "paidAt"<=${end} GROUP BY method`,

    prisma.$queryRaw<{ status: string; cnt: bigint; total: number }[]>`
      SELECT status, COUNT(*) as cnt, SUM(amount) as total FROM "Invoice"
      WHERE "issueDate">=${start} AND "issueDate"<=${end} GROUP BY status`,

    prisma.contract.findMany({ where: { active: true, type: "RECURRING" }, select: { amount: true } }),

    prisma.expense.groupBy({
      by: ["category"],
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  const revCur  = periodRev._sum.amount ?? 0;
  const revPrev = prevRev._sum.amount   ?? 0;
  const expCur  = periodExp._sum.amount ?? 0;
  const expPrev = prevExp._sum.amount   ?? 0;

  const profitCur  = revCur  - expCur;
  const profitPrev = revPrev - expPrev;
  const marginPct  = revCur > 0 ? (profitCur / revCur) * 100 : 0;

  const monthly12 = fillMonths(monthly12RevRaw, monthly12ExpRaw, chart12Start, new Date());
  const daily30   = fillDays(daily30Raw, 30);

  const spark6Rev  = monthly12.slice(-6).map(d => d.amount);
  const spark6Exp  = monthly12.slice(-6).map(d => d.expenses);
  const spark6Prof = monthly12.slice(-6).map(d => d.amount - d.expenses);

  const monthlyForecast = activeContracts.reduce((s: number, c) => s + c.amount, 0);
  const overdueTotal    = overdueInvoices.reduce((s: number, inv) => s + inv.amount, 0);

  const statusMap: Record<string, { count: number; amount: number }> = {};
  for (const r of statusRaw) {
    statusMap[r.status] = { count: Number(r.cnt), amount: Number(r.total) };
  }

  return {
    // Revenue
    periodRevenue:        revCur,
    revenueChange:        revPrev > 0 ? ((revCur - revPrev) / revPrev) * 100 : null,
    periodInvoicesAmount: periodInvoices._sum.amount ?? 0,
    periodInvoicesCount:  periodInvoices._count,
    // Expenses
    periodExpenses:       expCur,
    expensesChange:       expPrev > 0 ? ((expCur - expPrev) / expPrev) * 100 : null,
    expByCategory:        expByCategoryRaw.map(r => ({ category: r.category, amount: Number(r._sum.amount ?? 0) })),
    // P&L
    profitCur,
    profitPrev,
    profitChange:         profitPrev !== 0 ? ((profitCur - profitPrev) / Math.abs(profitPrev)) * 100 : null,
    marginPct,
    // Invoices
    overdueInvoices,
    overdueTotal,
    pendingAmount:        pendingInvoices._sum.amount ?? 0,
    pendingCount:         pendingInvoices._count,
    // Charts
    monthly12,
    daily30,
    spark6Rev,
    spark6Exp,
    spark6Prof,
    paymentMethodRevenue: methodRaw.map(r => ({ method: r.method, amount: Number(r.total) })),
    invoiceStatus:        statusMap,
    monthlyForecast,
  };
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PAID:      { label: "Pagate",    color: C.ok     },
  SENT:      { label: "Inviate",   color: C.info   },
  OVERDUE:   { label: "Insolute",  color: C.danger },
  DRAFT:     { label: "Bozze",     color: "#c4c8c7" },
  CANCELLED: { label: "Annullate", color: "#c4c8c7" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp     = await searchParams;
  const period = sp.period ?? "month";
  const data   = await getData(period, sp.from, sp.to);

  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? "Buongiorno" : "Buonasera";
  const timeStr  = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  // Stacked bar
  const statusOrder    = ["PAID", "SENT", "OVERDUE", "DRAFT", "CANCELLED"];
  const totalStatusAmt = statusOrder.reduce((s, k) => s + (data.invoiceStatus[k]?.amount ?? 0), 0) || 1;
  const stackedBars    = statusOrder
    .map(k => ({ key: k, ...STATUS_CFG[k], ...(data.invoiceStatus[k] ?? { count: 0, amount: 0 }) }))
    .filter(d => d.amount > 0);

  // Payment methods
  const METHOD_LABELS: Record<string, string> = { STRIPE: "Stripe", PAYPAL: "PayPal", BANK_TRANSFER: "Bonifico" };
  const totalMethodAmt = data.paymentMethodRevenue.reduce((s, d) => s + d.amount, 0) || 1;

  // Expense categories
  const { EXPENSE_CATEGORY_CFG } = await import("@/lib/expenses");
  const totalExpCat = data.expByCategory.reduce((s, d) => s + d.amount, 0) || 1;
  const topExpCats  = [...data.expByCategory].sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <div className="space-y-[14px]" style={{ maxWidth: 1200 }}>

      {/* Greeting */}
      <div className="space-y-0.5">
        <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
          {greeting}, Nicolò
        </h1>
        {data.overdueInvoices.length > 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
            Hai{" "}
            <span style={{ color: C.danger, fontWeight: 500 }}>
              {data.overdueInvoices.length} fatture insolute
            </span>{" "}
            — totale{" "}
            <span style={{ fontFamily: "var(--font-geist-mono)", color: C.danger }}>
              {fmtCompact(data.overdueTotal)}
            </span>
            . Ultimo aggiornamento alle {timeStr}.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Tutto in ordine. Ultimo aggiornamento alle {timeStr}.</p>
        )}
      </div>

      {/* Period filter */}
      <Suspense fallback={<div style={{ height: 32 }} />}>
        <PeriodFilter />
      </Suspense>

      {/* KPI row 1 — Revenue */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          eyebrow={`ENTRATE · ${now.toLocaleDateString("it-IT",{month:"long"}).toUpperCase()}`}
          value={formatCurrency(data.periodRevenue)}
          sub={data.periodRevenue === 0 ? "Nessun incasso" : undefined}
          change={data.revenueChange}
          valueColor={data.periodRevenue === 0 ? "var(--fg-3)" : "var(--fg)"}
          sparklineValues={data.spark6Rev}
          sparklineColor={data.periodRevenue === 0 ? "#c4c8c7" : C.ok}
        />
        <KpiCard
          eyebrow="SPESE · PERIODO"
          value={formatCurrency(data.periodExpenses)}
          sub={data.expByCategory.length > 0
            ? `${data.expByCategory.length} categorie`
            : "Nessuna spesa"}
          change={data.expensesChange !== null ? -data.expensesChange : null}
          valueColor={data.periodExpenses === 0 ? "var(--fg-3)" : C.danger}
          sparklineValues={data.spark6Exp}
          sparklineColor={C.danger}
        />
        <KpiCard
          eyebrow="UTILE NETTO"
          value={formatCurrency(data.profitCur)}
          sub={data.profitCur !== 0 ? `Margine: ${marginFmt(data.marginPct)}` : "Nessun dato"}
          change={data.profitChange}
          valueColor={data.profitCur > 0 ? C.ok : data.profitCur < 0 ? C.danger : "var(--fg-3)"}
          sparklineValues={data.spark6Prof}
          sparklineColor={data.profitCur >= 0 ? C.ok : C.danger}
        />
        <KpiCard
          eyebrow="DA INCASSARE"
          value={formatCurrency(data.pendingAmount)}
          sub={`${data.pendingCount} fatture aperte`}
          valueColor={data.pendingAmount > 0 ? C.warn : "var(--fg-3)"}
          sparklineValues={Array(6).fill(data.pendingAmount > 0 ? data.pendingAmount : 0)}
          sparklineColor={C.warn}
        />
      </div>

      {/* Area chart — full width */}
      <TrendChart monthly={data.monthly12} daily={data.daily30} />

      {/* P&L Summary bar */}
      <ProfitLossBar
        revenue={data.periodRevenue}
        expenses={data.periodExpenses}
        profit={data.profitCur}
        margin={data.marginPct}
      />

      {/* Bottom row 1: Fatture scadute + Spese per categoria */}
      <div className="grid grid-cols-12 gap-3">
        {/* Fatture scadute */}
        <div className="col-span-12 xl:col-span-8 rounded-[8px] p-[18px]" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.danger }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                Fatture scadute{" "}
                <span className="font-mono text-[12px]" style={{ color: "var(--fg-3)" }}>
                  {data.overdueInvoices.length}
                </span>
              </p>
            </div>
            <Link href="/invoices?status=OVERDUE" className="text-[12px] font-medium" style={{ color: "var(--info)" }}>
              Tutte →
            </Link>
          </div>

          {data.overdueInvoices.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessuna fattura scaduta</p>
          ) : (
            <div style={{ borderTop: "1px solid var(--subtle)" }}>
              {data.overdueInvoices.slice(0, 8).map((inv) => {
                const daysOver = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--subtle)" }}>
                    <div>
                      <Link href={`/invoices/${inv.id}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--fg)" }}>
                        {inv.client.name}
                      </Link>
                      <p className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>{inv.number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>
                        {daysOver}gg
                      </span>
                      <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: C.danger }}>
                        {fmtCompact(inv.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spese per categoria */}
        <div className="col-span-12 xl:col-span-4 rounded-[8px] p-[18px]" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.danger }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>Spese per categoria</p>
            </div>
            <Link href="/expenses" className="text-[12px] font-medium" style={{ color: "var(--info)" }}>
              Tutte →
            </Link>
          </div>

          {topExpCats.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessuna spesa nel periodo</p>
          ) : (
            <div className="space-y-3">
              {topExpCats.map(({ category, amount }) => {
                const cfg = EXPENSE_CATEGORY_CFG[category as string];
                return (
                  <div key={category as string}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg?.color ?? "#94a3b8" }} />
                        <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>{cfg?.label ?? category as string}</span>
                      </div>
                      <span className="font-mono text-[12px] tabular-nums" style={{ color: C.danger }}>
                        {fmtCompact(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--subtle)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${((amount / totalExpCat) * 100).toFixed(1)}%`,
                          backgroundColor: cfg?.color ?? "#94a3b8",
                          opacity: 0.75,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row 2: Stato fatture + Mix metodi + Previsione */}
      <div className="grid grid-cols-12 gap-3">
        {/* Stato fatture */}
        <div className="col-span-12 xl:col-span-5 rounded-[8px] p-[18px]" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-medium mb-4" style={{ color: "var(--fg)" }}>Stato Fatture</p>
          {stackedBars.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessuna fattura nel periodo</p>
          ) : (
            <div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                {stackedBars.map(d => (
                  <div key={d.key} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>{d.label}</span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>
                      {formatCurrency(d.amount)} ({d.count})
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ gap: 2 }}>
                {stackedBars.map(d => (
                  <div key={d.key} style={{ width: `${(d.amount / totalStatusAmt * 100).toFixed(1)}%`, backgroundColor: d.color, borderRadius: 99 }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mix metodi */}
        <div className="col-span-12 xl:col-span-3 rounded-[8px] p-[18px]" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-medium mb-4" style={{ color: "var(--fg)" }}>Mix Pagamenti</p>
          {data.paymentMethodRevenue.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessun dato</p>
          ) : (
            <div className="space-y-3">
              {data.paymentMethodRevenue.sort((a, b) => b.amount - a.amount).map(({ method, amount }) => (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>{METHOD_LABELS[method] ?? method}</span>
                    <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--fg)" }}>{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--subtle)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(amount / totalMethodAmt * 100).toFixed(1)}%`, backgroundColor: C.info }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Previsione di cassa */}
        <div className="col-span-12 xl:col-span-4 rounded-[8px] p-[18px]" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.ok }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>Previsione cashflow</p>
          </div>
          {data.monthlyForecast === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--fg-3)" }}>Nessun contratto ricorrente attivo</p>
          ) : (
            <div className="space-y-3">
              {[1,2,3,4,5,6].map(offset => {
                const d = new Date(); d.setMonth(d.getMonth()+offset);
                const lbl = d.toLocaleDateString("it-IT",{month:"short",year:"numeric"});
                return (
                  <div key={offset}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] capitalize" style={{ color: "var(--fg-2)" }}>{lbl}</span>
                      <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--fg)" }}>
                        {fmtCompact(data.monthlyForecast)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--subtle)" }}>
                      <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: C.ok }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function marginFmt(pct: number): string {
  return `${pct >= 0 ? "" : ""}${pct.toFixed(1)}%`;
}

// ── P&L Summary bar component ─────────────────────────────────────────────────

function ProfitLossBar({
  revenue, expenses, profit, margin,
}: {
  revenue: number; expenses: number; profit: number; margin: number;
}) {
  const isPositive = profit >= 0;

  return (
    <div
      className="rounded-[8px] p-[18px]"
      style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: isPositive ? C.ok : C.danger }}
        />
        <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
          Conto Economico — periodo
        </p>
        <span
          className="font-mono text-[11px] px-1.5 py-0.5 rounded ml-auto"
          style={{
            backgroundColor: isPositive ? C.ok + "18" : C.danger + "18",
            color: isPositive ? C.ok : C.danger,
            border: `1px solid ${isPositive ? C.ok : C.danger}30`,
          }}
        >
          Margine {margin.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: "Entrate",    value: revenue,  color: C.ok,     sign: "+" },
          { label: "Uscite",     value: expenses, color: C.danger, sign: "−" },
          { label: "Utile netto",value: profit,   color: isPositive ? C.ok : C.danger, sign: profit >= 0 ? "=" : "=" },
        ].map(({ label, value, color, sign }) => (
          <div key={label} className="text-center">
            <p className="text-[11px] font-mono uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.08em" }}>{label}</p>
            <p
              className="font-semibold tabular-nums"
              style={{ fontSize: 20, letterSpacing: "-0.02em", color, marginTop: 2 }}
            >
              {sign !== "=" ? sign : ""}{formatCurrency(Math.abs(value))}
            </p>
          </div>
        ))}
      </div>

      {/* Visual bar: revenue = full width, expenses = red portion */}
      {revenue > 0 && (
        <div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--subtle)" }}>
            <div className="h-full flex">
              <div
                className="h-full rounded-full"
                style={{
                  width: expenses > 0 ? `${Math.min((expenses / revenue) * 100, 100).toFixed(1)}%` : "0%",
                  backgroundColor: C.danger,
                  opacity: 0.7,
                }}
              />
              <div
                className="h-full flex-1 rounded-full"
                style={{ backgroundColor: C.ok, opacity: 0.7 }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px]" style={{ color: C.danger }}>Spese {((expenses/revenue)*100).toFixed(0)}%</span>
            <span className="font-mono text-[10px]" style={{ color: C.ok }}>Margine {margin.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
