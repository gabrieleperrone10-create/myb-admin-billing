import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_CFG } from "@/lib/expenses";
import { ExpenseCategory } from "@prisma/client";
import { Plus, ChevronRight } from "lucide-react";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_CFG) as ExpenseCategory[];

async function getData(category?: string, from?: string, to?: string) {
  const where: Record<string, unknown> = {};

  if (category && CATEGORIES.includes(category as ExpenseCategory)) {
    where.category = category as ExpenseCategory;
  }

  const start = from ? new Date(from) : undefined;
  const end   = to   ? new Date(to + "T23:59:59") : undefined;
  if (start || end) {
    where.date = {};
    if (start) (where.date as Record<string, Date>).gte = start;
    if (end)   (where.date as Record<string, Date>).lte = end;
  }

  const [expenses, totByCategory] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return { expenses, totByCategory };
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; from?: string; to?: string }>;
}) {
  const sp   = await searchParams;
  const data = await getData(sp.category, sp.from, sp.to);

  const grandTotal = data.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4" style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold" style={{ letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Spese
          </h1>
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
            {data.expenses.length} voci · totale{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--danger)" }}>
              {formatCurrency(grandTotal)}
            </span>
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-1.5 px-3 rounded-[var(--r-md)] text-[13px] font-semibold"
          style={{ backgroundColor: "var(--fg)", color: "#ffffff", height: 40, minHeight: "unset" }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nuova spesa</span>
          <span className="sm:hidden">Nuova</span>
        </Link>
      </div>

      {/* Category pills — scrollable on mobile */}
      <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <Link
          href="/expenses"
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors shrink-0"
          style={{
            backgroundColor: !sp.category ? "var(--fg)" : "var(--surface)",
            color: !sp.category ? "#ffffff" : "var(--fg-2)",
            borderColor: !sp.category ? "var(--fg)" : "var(--border)",
            minHeight: "unset",
          }}
        >
          Tutte
        </Link>
        {data.totByCategory
          .sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))
          .map(({ category, _sum, _count }) => {
            const cfg = EXPENSE_CATEGORY_CFG[category];
            const active = sp.category === category;
            return (
              <Link
                key={category}
                href={`/expenses?category=${category}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors shrink-0"
                style={{
                  backgroundColor: active ? cfg.color : "var(--surface)",
                  color: active ? "#ffffff" : "var(--fg-2)",
                  borderColor: active ? cfg.color : "var(--border)",
                  minHeight: "unset",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? "#ffffff" : cfg.color }} />
                {cfg.label}
                <span className="font-mono opacity-75">{_count}</span>
              </Link>
            );
          })}
      </div>

      {data.expenses.length === 0 ? (
        <div className="text-center py-12 text-[13px]" style={{ color: "var(--fg-3)" }}>
          Nessuna spesa trovata.{" "}
          <Link href="/expenses/new" style={{ color: "var(--info)" }}>Aggiungi la prima →</Link>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {data.expenses.map((exp) => {
              const cfg = EXPENSE_CATEGORY_CFG[exp.category];
              return (
                <Link
                  key={exp.id}
                  href={`/expenses/${exp.id}`}
                  className="mobile-card flex items-center gap-3"
                  style={{ minHeight: "unset" }}
                >
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cfg.color + "18" }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-fg truncate">{exp.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] px-1.5 py-[1px] rounded-full badge" style={{ backgroundColor: cfg.color + "18", color: cfg.color }}>{cfg.label}</span>
                      <span className="font-mono text-[11px] text-fg-3">
                        {new Date(exp.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                      {formatCurrency(exp.amount)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-fg-3" strokeWidth={1.8} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--subtle)", borderBottom: "1px solid var(--border)" }}>
                  {["DATA", "DESCRIZIONE", "FORNITORE", "CATEGORIA", "IMPORTO", ""].map((h) => (
                    <th key={h} className="font-mono text-left px-4 py-2.5" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.08em", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((exp) => {
                  const cfg = EXPENSE_CATEGORY_CFG[exp.category];
                  return (
                    <tr key={exp.id} className="group" style={{ borderBottom: "1px solid var(--subtle)" }}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[12px]" style={{ color: "var(--fg-3)" }}>
                          {new Date(exp.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/expenses/${exp.id}`} className="text-[13px] font-medium hover:underline" style={{ color: "var(--fg)", minHeight: "unset" }}>
                          {exp.description}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{exp.vendor ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-medium badge" style={{ backgroundColor: cfg.color + "18", color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: "var(--danger)" }}>
                          {formatCurrency(exp.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/expenses/${exp.id}`} className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--info)", minHeight: "unset" }}>
                          Modifica →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
