export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileCheck, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "Abbonamento",
  COACHING:     "Coaching",
  CONSULTING:   "Consulenza",
  DIGITAL:      "Prodotto Digitale",
};

export default async function ContractsPage() {
  const contracts = await prisma.contract.findMany({
    include: { client: true, product: true, deposit: true, _count: { select: { invoices: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Contratti</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{contracts.length} contratti totali</p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Nuovo Contratto
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Prodotto</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Tipo</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Inizio</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Deposito</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon={FileCheck} title="Nessun contratto ancora" subtitle="Crea un contratto per collegare clienti e prodotti" action={
                    <Link href="/contracts/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors">
                      <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nuovo Contratto
                    </Link>
                  } />
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{c.client.name}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-2">{c.product.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="info">{TYPE_LABELS[c.product.type] ?? c.product.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-[13px] font-medium text-fg tabular-nums">
                      {formatCurrency(c.amount)}
                    </span>
                    {c.type === "RECURRING" && (
                      <span className="font-mono text-[10px] text-fg-3">/mese</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(c.startDate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-fg-2 tabular-nums">
                    {c.deposit ? formatCurrency(c.deposit.amount) : <span className="text-fg-3">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={c.active ? "ok" : "neutral"}>{c.active ? "Attivo" : "Inattivo"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/contracts/${c.id}`} className="text-[12px] font-medium text-info hover:underline">
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
