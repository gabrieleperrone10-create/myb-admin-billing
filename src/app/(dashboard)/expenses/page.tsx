import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORY_CFG } from "@/lib/expenses";
import { ExpenseCategory } from "@prisma/client";

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
    <div className="space-y-[14px]" style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Spese
          </h1>
          <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
            {data.expenses.length} voci · totale{" "}
            <span className="font-mono" style={{ color: "var(--danger)" }}>
              {formatCurrency(grandTotal)}
            </span>
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12px] font-medium"
          style={{ backgroundColor: "var(--fg)", color: "#ffffff" }}
        >
          + Nuova spesa
        </Link>
      </div>

      {/* Category summary pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
          style={{
            backgroundColor: !sp.category ? "var(--fg)" : "transparent",
            color: !sp.category ? "#ffffff" : "var(--fg-2)",
            borderColor: !sp.category ? "var(--fg)" : "var(--border)",
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                style={{
                  backgroundColor: active ? cfg.color : "transparent",
                  color: active ? "#ffffff" : "var(--fg-2)",
                  borderColor: active ? cfg.color : "var(--border)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: active ? "#ffffff" : cfg.color }}
                />
                {cfg.label}
                <span
                  className="font-mono"
                  style={{ opacity: 0.75 }}
                >
                  {formatCurrency(_sum.amount ?? 0)} ({_count})
                </span>
              </Link>
            );
          })}
      </div>

      {/* Table */}
      <div className="rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: "var(--subtle)", borderBottom: "1px solid var(--border)" }}>
              {["DATA", "DESCRIZIONE", "FORNITORE", "CATEGORIA", "IMPORTO", ""].map((h) => (
                <th
                  key={h}
                  className="font-mono text-left px-4 py-2.5"
                  style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.08em", fontWeight: 500 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[13px]" style={{ color: "var(--fg-3)" }}>
                  Nessuna spesa trovata. <Link href="/expenses/new" style={{ color: "var(--info)" }}>Aggiungi la prima →</Link>
                </td>
              </tr>
            ) : (
              data.expenses.map((exp) => {
                const cfg = EXPENSE_CATEGORY_CFG[exp.category];
                return (
                  <tr
                    key={exp.id}
                    className="group"
                    style={{ borderBottom: "1px solid var(--subtle)" }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px]" style={{ color: "var(--fg-3)" }}>
                        {new Date(exp.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/expenses/${exp.id}`}
                        className="text-[13px] font-medium hover:underline"
                        style={{ color: "var(--fg)" }}
                      >
                        {exp.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>
                        {exp.vendor ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-medium"
                        style={{
                          backgroundColor: cfg.color + "18",
                          color: cfg.color,
                          border: `1px solid ${cfg.color}30`,
                        }}
                      >
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
                      <Link
                        href={`/expenses/${exp.id}`}
                        className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--info)" }}
                      >
                        Modifica →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
