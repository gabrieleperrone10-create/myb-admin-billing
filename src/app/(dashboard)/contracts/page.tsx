export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileCheck, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string; type?: string }>;
}) {
  const sp     = await searchParams;
  const q      = sp.q ?? "";
  const active = sp.active;
  const type   = sp.type ?? "";

  const contracts = await prisma.contract.findMany({
    where: {
      ...(active === "1" ? { active: true } : active === "0" ? { active: false } : {}),
      ...(type ? { type: type as never } : {}),
      ...(q ? { OR: [
        { client:  { name: { contains: q, mode: "insensitive" } } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ]} : {}),
    },
    include: { client: true, product: true, deposit: true, _count: { select: { invoices: true } } },
    orderBy: { createdAt: "desc" },
  });

  const filterLink = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...extra });
    return `/contracts?${p.toString()}`;
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Contratti</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{contracts.length} risultati</p>
        </div>
        <Link href="/contracts/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0">
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />Nuovo Contratto
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per cliente o prodotto…" className="w-64" />
        </Suspense>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Tutti",     href: filterLink({}) },
            { label: "Attivi",    href: filterLink({ active: "1" }) },
            { label: "Inattivi",  href: filterLink({ active: "0" }) },
            { label: "Ricorrenti",href: filterLink({ type: "RECURRING" }) },
            { label: "One-shot",  href: filterLink({ type: "ONE_SHOT" }) },
          ].map(opt => (
            <Link key={opt.label} href={opt.href} className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors" style={{ backgroundColor: "transparent", color: "var(--fg-2)", borderColor: "var(--border)" }}>
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
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Tipo</th>
              <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Inizio</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr><td colSpan={7}><EmptyState icon={FileCheck} title="Nessun contratto trovato" subtitle={q ? `Nessun risultato per "${q}"` : "Crea il primo contratto"} action={!q ? <Link href="/contracts/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)]"><Plus className="w-3.5 h-3.5" strokeWidth={2} />Nuovo Contratto</Link> : undefined} /></td></tr>
            ) : contracts.map((c) => (
              <tr key={c.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{c.client.name}</td>
                <td className="px-4 py-2.5 text-[13px] text-fg-2">{c.product.name}</td>
                <td className="px-4 py-2.5"><Badge variant="info">{c.type === "RECURRING" ? "Ricorrente" : "One-shot"}</Badge></td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-mono text-[13px] font-medium text-fg tabular-nums">{formatCurrency(c.amount)}</span>
                  {c.type === "RECURRING" && <span className="font-mono text-[10px] text-fg-3">/mese</span>}
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(c.startDate)}</td>
                <td className="px-4 py-2.5"><Badge variant={c.active ? "ok" : "neutral"}>{c.active ? "Attivo" : "Inattivo"}</Badge></td>
                <td className="px-4 py-2.5 text-right"><Link href={`/contracts/${c.id}`} className="text-[12px] font-medium text-info hover:underline">Dettagli</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
