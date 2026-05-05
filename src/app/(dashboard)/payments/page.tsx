import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const METHOD_LABELS: Record<string, string> = {
  STRIPE:        "Stripe",
  PAYPAL:        "PayPal",
  BANK_TRANSFER: "Bonifico",
};

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: {
      invoice: { include: { client: true } },
      deposit: { include: { contract: { include: { client: true } } } },
    },
    orderBy: { paidAt: "desc" },
  });

  const total = payments.reduce((s: number, p) => s + p.amount, 0);

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Pagamenti</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          {payments.length} pagamenti · Totale{" "}
          <span className="font-mono font-medium text-fg tabular-nums">{formatCurrency(total)}</span>
        </p>
      </div>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Data</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Riferimento</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Metodo</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={CreditCard} title="Nessun pagamento registrato" subtitle="I pagamenti appariranno qui una volta registrati" />
                </td>
              </tr>
            ) : (
              payments.map((p) => {
                const clientName = p.invoice?.client?.name ?? p.deposit?.contract?.client?.name ?? "—";
                const ref = p.invoice?.number ?? (p.depositId ? "Deposito" : "—");
                return (
                  <tr key={p.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(p.paidAt)}</td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{clientName}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-info">{ref}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="neutral">{METHOD_LABELS[p.method] ?? p.method}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-[13px] font-medium text-fg tabular-nums">
                        {formatCurrency(p.amount)}
                      </span>
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
