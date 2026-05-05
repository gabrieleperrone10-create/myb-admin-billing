export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { InvoiceStatusBadge, type InvoiceStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: { client: true },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Fatture</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{invoices.length} fatture totali</p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Nuova Fattura
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
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
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={FileText}
                    title="Nessuna fattura ancora"
                    subtitle="Crea la tua prima fattura"
                    action={
                      <Link
                        href="/invoices/new"
                        className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                        Nuova Fattura
                      </Link>
                    }
                  />
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono text-[11px] text-info hover:underline"
                    >
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{inv.client.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-[13px] font-medium text-fg tabular-nums">
                      {formatCurrency(inv.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-2.5">
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/invoices/${inv.id}`} className="text-[12px] font-medium text-info hover:underline">
                      Dettagli
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
