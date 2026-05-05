export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { DepositStatusBadge, Badge, type DepositStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import Link from "next/link";
import { Suspense } from "react";

const METHOD_LABELS: Record<string, string> = {
  STRIPE:        "Stripe",
  PAYPAL:        "PayPal",
  BANK_TRANSFER: "Bonifico",
};

const STATUS_OPTIONS = [
  { value: "",         label: "Tutti" },
  { value: "PENDING",  label: "In attesa" },
  { value: "PAID",     label: "Pagati" },
  { value: "REFUNDED", label: "Rimborsati" },
];

export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp     = await searchParams;
  const q      = sp.q ?? "";
  const status = sp.status ?? "";

  const deposits = await prisma.deposit.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [
        { contract: { client: { name: { contains: q, mode: "insensitive" } } } },
        { contract: { product: { name: { contains: q, mode: "insensitive" } } } },
      ]} : {}),
    },
    include: { contract: { include: { client: true, product: true } }, payment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Depositi</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">{deposits.length} depositi totali</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per cliente o prodotto…" className="w-64" />
        </Suspense>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(opt => (
            <Link
              key={opt.value}
              href={`/deposits?${new URLSearchParams({ ...(q ? { q } : {}), ...(opt.value ? { status: opt.value } : {}) }).toString()}`}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              style={{
                backgroundColor: status === opt.value ? "var(--fg)" : "transparent",
                color: status === opt.value ? "#ffffff" : "var(--fg-2)",
                borderColor: status === opt.value ? "var(--fg)" : "var(--border)",
              }}
            >
              {opt.label}
            </Link>
          ))}
        </div>
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
                  <EmptyState
                    icon={Wallet}
                    title="Nessun deposito trovato"
                    subtitle={q || status ? "Prova a modificare i filtri" : "I depositi sono collegati automaticamente ai contratti"}
                  />
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
