import { Suspense } from "react";
import Link from "next/link";
import { requireCompany } from "@/lib/company";
import type { CompanyDb } from "@/lib/db";
import type { Company } from "@prisma/client";
import { formatCurrency } from "@/lib/utils";
import { KpiCard } from "@/components/ui/KpiCard";
import PeriodFilter from "./PeriodFilter";
import TrendChart from "./TrendChart";
import { BankBalanceCard } from "./BankBalanceCard";
import { objectiveProgress, krProgress } from "@/lib/objectives";
import type { KRType } from "@prisma/client";

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

async function getData(db: CompanyDb, companyId: string, company: Company, period: string, from?: string, to?: string) {
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
    volumeVenditeRaw,
    expByCategoryRaw,
    activeObjectives,
  ] = await Promise.all([
    db.payment.aggregate({ where: { paidAt: { gte: start, lte: end }, method: { not: "STRIPE" } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd }, method: { not: "STRIPE" } }, _sum: { amount: true } }),

    db.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),

    db.invoice.findMany({ where: { status: "OVERDUE" }, include: { client: true }, orderBy: { dueDate: "asc" } }),
    db.invoice.aggregate({ where: { status: "SENT" }, _sum: { amount: true }, _count: true }),
    db.invoice.aggregate({ where: { issueDate: { gte: start, lte: end } }, _sum: { amount: true }, _count: true }),

    // Bucketing per TO_CHAR: nessun equivalente Prisma, resta raw. Filtro
    // companyId esplicito perche' $queryRaw non passa dall'estensione.
    db.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR("paidAt",'YYYY-MM') as period, SUM(amount) as total
      FROM "Payment" WHERE "companyId" = ${companyId} AND "paidAt">=${chart12Start} AND method != 'STRIPE'
      GROUP BY period ORDER BY period`,

    db.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR(date,'YYYY-MM') as period, SUM(amount) as total
      FROM "Expense" WHERE "companyId" = ${companyId} AND date>=${chart12Start}
      GROUP BY period ORDER BY period`,

    db.$queryRaw<{ period: string; total: number }[]>`
      SELECT TO_CHAR("paidAt",'YYYY-MM-DD') as period, SUM(amount) as total
      FROM "Payment" WHERE "companyId" = ${companyId} AND "paidAt">=${chart30Start} AND method != 'STRIPE'
      GROUP BY period ORDER BY period`,

    // groupBy Prisma normale al posto del raw: gia' scoped dall'estensione.
    db.payment.groupBy({
      by: ["method"],
      where: { paidAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),

    db.invoice.groupBy({
      by: ["status"],
      where: { issueDate: { gte: start, lte: end } },
      _count: true,
      _sum: { amount: true },
    }),

    db.contract.findMany({ where: { active: true, type: "RECURRING" }, select: { amount: true } }),

    // Volume vendite: nuovi contratti firmati nel periodo
    db.contract.aggregate({ where: { startDate: { gte: start, lte: end } }, _sum: { amount: true } }),

    db.expense.groupBy({
      by: ["category"],
      where: { date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),

    // Obiettivi attivi: trimestre corrente + annuale + mese corrente
    (() => {
      const m = new Date().getMonth();
      const q = `Q${Math.ceil((m + 1) / 3)}` as "Q1"|"Q2"|"Q3"|"Q4";
      const mKey = `M${m + 1}` as never;
      return db.objective.findMany({
        where: { period: { in: [q, "ANNUAL", mKey] } },
        include: { keyResults: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
    })(),
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
  const volumeVendite   = volumeVenditeRaw._sum.amount ?? 0;

  const bankBalance   = company.bankBalance ?? null;
  const bankBalanceAt = company.bankBalanceAt ?? null;
  let estimatedBalance: number | null = null;
  if (bankBalance !== null && bankBalanceAt !== null) {
    const [incomeSince, expSince] = await Promise.all([
      db.payment.aggregate({ where: { paidAt: { gte: bankBalanceAt }, method: { not: "STRIPE" } }, _sum: { amount: true } }),
      db.expense.aggregate({ where: { date: { gte: bankBalanceAt } }, _sum: { amount: true } }),
    ]);
    estimatedBalance = bankBalance + (incomeSince._sum.amount ?? 0) - (expSince._sum.amount ?? 0);
  }

  const statusMap: Record<string, { count: number; amount: number }> = {};
  for (const r of statusRaw) {
    statusMap[r.status] = { count: r._count, amount: r._sum.amount ?? 0 };
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
    paymentMethodRevenue: methodRaw.map(r => ({ method: r.method, amount: r._sum.amount ?? 0 })),
    invoiceStatus:        statusMap,
    monthlyForecast,
    volumeVendite,
    bankBalance,
    bankBalanceAt,
    estimatedBalance,
    activeObjectives,
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
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const { db, companyId, company } = await requireCompany(slug);
  const period = sp.period ?? "month";
  const data   = await getData(db, companyId, company, period, sp.from, sp.to);

  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
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
    <div className="space-y-4 md:space-y-[14px]" style={{ maxWidth: 1200 }}>

      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="font-bold" style={{ fontSize: "clamp(20px, 5vw, 26px)", letterSpacing: "-0.025em", color: "var(--fg)" }}>
          {greeting}, Gabriele 👋
        </h1>
        {data.overdueInvoices.length > 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-2)" }}>
            <span style={{ color: C.danger, fontWeight: 600 }}>
              {data.overdueInvoices.length} fatture insolute
            </span>{" "}
            · totale{" "}
            <span style={{ fontFamily: "var(--font-geist-mono)", color: C.danger, fontWeight: 600 }}>
              {fmtCompact(data.overdueTotal)}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-3)" }}>Tutto in ordine · {timeStr}</p>
        )}
      </div>

      {/* Obiettivi attivi */}
      <OkrWidget objectives={data.activeObjectives} slug={slug} />

      {/* Saldo CC + Volume vendite */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BankBalanceCard
          bankBalance={data.bankBalance}
          bankBalanceAt={data.bankBalanceAt}
          estimatedBalance={data.estimatedBalance}
        />
        <div className="rounded-[var(--r-lg)] p-4 md:p-[18px] flex flex-col gap-2"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>
            VOLUME VENDITE · PERIODO
          </p>
          <p className="font-mono font-semibold tabular-nums" style={{ fontSize: 22, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            {formatCurrency(data.volumeVendite)}
          </p>
          <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
            {data.volumeVendite === 0
              ? "Nessun contratto firmato nel periodo"
              : "Valore contratti firmati nel periodo"}
          </p>
        </div>
      </div>

      {/* Period filter */}
      <Suspense fallback={<div style={{ height: 36 }} />}>
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Fatture scadute */}
        <div className="xl:col-span-8 rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
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
            <Link href={`/${slug}/invoices?status=OVERDUE`} className="text-[12px] font-medium" style={{ color: "var(--info)" }}>
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
                      <Link href={`/${slug}/invoices/${inv.id}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--fg)" }}>
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
        <div className="xl:col-span-4 rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.danger }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>Spese per categoria</p>
            </div>
            <Link href={`/${slug}/expenses`} className="text-[12px] font-medium" style={{ color: "var(--info)" }}>
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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* Stato fatture */}
        <div className="xl:col-span-5 rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
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
        <div className="xl:col-span-3 rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
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
        <div className="xl:col-span-4 rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
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

// ── OKR Widget ────────────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<string, string> = {
  Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4", ANNUAL: "Anno",
  M1:"Gen",M2:"Feb",M3:"Mar",M4:"Apr",M5:"Mag",M6:"Giu",
  M7:"Lug",M8:"Ago",M9:"Set",M10:"Ott",M11:"Nov",M12:"Dic",
};

type ObjWithKRs = {
  id: string; title: string; period: string;
  keyResults: { type: KRType; target: number|null; current: number|null; completed: boolean }[];
};

function OkrWidget({ objectives, slug }: { objectives: ObjWithKRs[]; slug: string }) {
  if (objectives.length === 0) return null;

  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.info }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>Obiettivi attivi</p>
        </div>
        <Link href={`/${slug}/objectives`} className="text-[12px] font-medium" style={{ color: "var(--info)" }}>
          Tutti →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {objectives.map(obj => {
          const pct = objectiveProgress(obj.keyResults);
          const done = obj.keyResults.filter(kr => krProgress(kr) >= 100).length;
          const color = pct >= 75 ? C.ok : pct >= 40 ? C.warn : C.info;
          const circumference = 2 * Math.PI * 18;
          const dash = (pct / 100) * circumference;

          return (
            <Link key={obj.id} href={`/${slug}/objectives`} className="flex items-center gap-3 p-3 rounded-[var(--r-md)] transition-colors hover:bg-[var(--subtle)]" style={{ border: "1px solid var(--subtle)" }}>
              {/* Progress ring */}
              <div className="shrink-0 relative" style={{ width: 44, height: 44 }}>
                <svg width="44" height="44" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="var(--subtle)" strokeWidth="3.5" />
                  <circle
                    cx="22" cy="22" r="18" fill="none"
                    stroke={color} strokeWidth="3.5"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-bold" style={{ color }}>
                  {pct}%
                </span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{obj.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: C.info + "15", color: C.info }}>
                    {PERIOD_LABEL[obj.period] ?? obj.period}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--fg-3)" }}>
                    {done}/{obj.keyResults.length} KR
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
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
      className="rounded-[var(--r-lg)] p-4 md:p-[18px]"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
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
