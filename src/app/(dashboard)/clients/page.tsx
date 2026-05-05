export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

async function ClientsTable({ q }: { q: string }) {
  const clients = await prisma.client.findMany({
    where: q ? {
      OR: [
        { name:    { contains: q, mode: "insensitive" } },
        { email:   { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
      ],
    } : undefined,
    include: { _count: { select: { contracts: true, invoices: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (clients.length === 0) return (
    <tr><td colSpan={6}>
      <EmptyState icon={Users} title="Nessun cliente trovato" subtitle={q ? `Nessun risultato per "${q}"` : "Aggiungi il tuo primo cliente"} action={!q ? <Link href="/clients/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)]"><Plus className="w-3.5 h-3.5" strokeWidth={2} />Nuovo Cliente</Link> : undefined} />
    </td></tr>
  );

  return <>{clients.map((c) => (
    <tr key={c.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
      <td className="px-4 py-2.5">
        <p className="text-[13px] font-medium text-fg">{c.name}</p>
        {c.country && <p className="font-mono text-[11px] text-fg-3">{c.country}</p>}
      </td>
      <td className="px-4 py-2.5 text-[13px] text-fg-2">{c.company ?? <span className="text-fg-3">—</span>}</td>
      <td className="px-4 py-2.5 text-[13px] text-fg-2">{c.email}</td>
      <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2 tabular-nums">{c._count.contracts}</td>
      <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2 tabular-nums">{c._count.invoices}</td>
      <td className="px-4 py-2.5 text-right">
        <Link href={`/clients/${c.id}`} className="text-[12px] font-medium text-info hover:underline">Dettagli</Link>
      </td>
    </tr>
  ))}</>;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q  = sp.q ?? "";

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Clienti</h1>
        </div>
        <Link href="/clients/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0">
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />Nuovo Cliente
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchInput placeholder="Cerca per nome, email, azienda…" className="max-w-sm" />
      </Suspense>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Azienda</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Email</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Contratti</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Fatture</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            <Suspense fallback={<tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-fg-3">Caricamento…</td></tr>}>
              <ClientsTable q={q} />
            </Suspense>
          </tbody>
        </table>
      </div>
    </div>
  );
}
