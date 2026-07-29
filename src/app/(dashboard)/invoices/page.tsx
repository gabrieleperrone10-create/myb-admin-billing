export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { InvoiceStatusBadge, type InvoiceStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",           label: "Tutti" },
  { value: "DRAFT",     label: "Bozze" },
  { value: "SENT",      label: "Inviate" },
  { value: "PAID",      label: "Pagate" },
  { value: "OVERDUE",   label: "Insolute" },
  { value: "CANCELLED", label: "Annullate" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp     = await searchParams;
  const q      = sp.q ?? "";
  const status = sp.status ?? "";

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [
        { number: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ]} : {}),
    },
    include: { client: true },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div className="space-y-4 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Fatture</h1>
          <p className="text-[12px] text-fg-3 mt-0.5">{invoices.length} risultati</p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 px-3 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)] transition-colors shrink-0"
          style={{ height: 40, minHeight: "unset" }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nuova Fattura</span>
          <span className="sm:hidden">Nuova</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per numero o cliente…" className="w-full md:w-72" />
        </Suspense>
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STATUS_OPTIONS.map(opt => (
            <Link
              key={opt.value}
              href={`/invoices?${new URLSearchParams({ ...(q ? { q } : {}), ...(opt.value ? { status: opt.value } : {}) }).toString()}`}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors"
              style={{
                backgroundColor: status === opt.value ? "var(--fg)" : "var(--surface)",
                color: status === opt.value ? "var(--surface)" : "var(--fg-2)",
                borderColor: status === opt.value ? "var(--fg)" : "var(--border)",
                minHeight: "unset",
              }}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nessuna fattura trovata"
          subtitle={q || status ? "Prova a modificare i filtri" : "Crea la tua prima fattura"}
          action={!q && !status ? (
            <Link href="/invoices/new" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)]" style={{ minHeight: "unset" }}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />Nuova Fattura
            </Link>
          ) : undefined}
        />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="mobile-card flex items-center gap-3"
                style={{ minHeight: "unset" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-fg-3">{inv.number}</span>
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </div>
                  <p className="text-[15px] font-semibold text-fg truncate">{inv.client.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-fg-3">Scad. {formatDate(inv.dueDate)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: inv.status === "OVERDUE" ? "var(--danger)" : "var(--fg)" }}>
                    {formatCurrency(inv.amount)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-fg-3" strokeWidth={1.8} />
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-subtle border-b border-border">
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">N°</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
                  <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Emissione</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Scadenza</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                    <td className="px-4 py-2.5"><Link href={`/invoices/${inv.id}`} className="font-mono text-[11px] text-info hover:underline">{inv.number}</Link></td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{inv.client.name}</td>
                    <td className="px-4 py-2.5 text-right"><span className="font-mono text-[13px] font-medium text-fg tabular-nums">{formatCurrency(inv.amount)}</span></td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-2.5"><InvoiceStatusBadge status={inv.status as InvoiceStatus} /></td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/invoices/${inv.id}`} className="text-[12px] font-medium text-info hover:underline">Dettagli</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
