export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { DepositStatusBadge, Badge, type DepositStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const METHOD_LABELS: Record<string, string> = {
  STRIPE:        "Stripe",
  PAYPAL:        "PayPal",
  BANK_TRANSFER: "Bonifico",
};

export default async function DepositsPage() {
  const deposits = await prisma.deposit.findMany({
    include: { contract: { include: { client: true, product: true } }, payment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Depositi</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">{deposits.length} depositi totali</p>
      </div>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Prodotto</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Pagato il</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Metodo</th>
            </tr>
          </thead>
          <tbody>
            {deposits.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={Wallet} title="Nessun deposito registrato" subtitle="I depositi sono collegati automaticamente ai contratti" />
                </td>
              </tr>
            ) : (
              deposits.map((d) => (
                <tr key={d.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{d.contract.client.name}</td>
                  <td className="px-4 py-2.5 text-[13px] text-fg-2">{d.contract.product.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-[13px] font-medium text-fg tabular-nums">
                      {formatCurrency(d.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <DepositStatusBadge status={d.status as DepositStatus} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">
                    {d.paidAt ? formatDate(d.paidAt) : <span className="text-fg-3">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {d.payment ? (
                      <Badge variant="neutral">{METHOD_LABELS[d.payment.method] ?? d.payment.method}</Badge>
                    ) : (
                      <span className="text-fg-3 text-[12px]">—</span>
                    )}
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
