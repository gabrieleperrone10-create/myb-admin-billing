export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import Link from "next/link";
import { Suspense } from "react";

const METHOD_LABELS: Record<string, string> = {
  STRIPE:        "Stripe",
  PAYPAL:        "PayPal",
  BANK_TRANSFER: "Bonifico",
};

const METHOD_OPTIONS = [
  { value: "",              label: "Tutti i metodi" },
  { value: "STRIPE",        label: "Stripe" },
  { value: "PAYPAL",        label: "PayPal" },
  { value: "BANK_TRANSFER", label: "Bonifico" },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; method?: string }>;
}) {
  const sp     = await searchParams;
  const q      = sp.q ?? "";
  const method = sp.method ?? "";

  const payments = await prisma.payment.findMany({
    where: {
      ...(method ? { method: method as never } : {}),
      ...(q ? { OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { invoice: { OR: [
          { number: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ]}},
      ]} : {}),
    },
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

      <div className="flex items-center gap-3 flex-wrap">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per cliente o riferimento…" className="w-64" />
        </Suspense>
        <div className="flex gap-1.5">
          {METHOD_OPTIONS.map(opt => (
            <Link
              key={opt.value}
              href={`/payments?${new URLSearchParams({ ...(q ? { q } : {}), ...(opt.value ? { method: opt.value } : {}) }).toString()}`}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              style={{
                backgroundColor: method === opt.value ? "var(--fg)" : "transparent",
                color: method === opt.value ? "#ffffff" : "var(--fg-2)",
                borderColor: method === opt.value ? "var(--fg)" : "var(--border)",
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
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Data</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Riferimento</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Metodo</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon={CreditCard} title="Nessun pagamento trovato" subtitle={q || method ? "Prova a modificare i filtri" : "I pagamenti appariranno qui una volta registrati"} /></td></tr>
            ) : payments.map((p) => {
              const clientName = p.invoice?.client?.name ?? p.deposit?.contract?.client?.name ?? "—";
              const ref        = p.invoice?.number ?? (p.depositId ? "Deposito" : "—");
              return (
                <tr key={p.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(p.paidAt)}</td>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{clientName}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-info">{ref}</td>
                  <td className="px-4 py-2.5"><Badge variant="neutral">{METHOD_LABELS[p.method] ?? p.method}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><span className="font-mono text-[13px] font-medium text-fg tabular-nums">{formatCurrency(p.amount)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
