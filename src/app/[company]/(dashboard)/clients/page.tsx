export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import type { CompanyDb } from "@/lib/db";
import Link from "next/link";
import { Users, Plus, ChevronRight, FileCheck, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

async function ClientsList({ db, slug, q }: { db: CompanyDb; slug: string; q: string }) {
  const clients = await db.client.findMany({
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
    <div className="col-span-full">
      <EmptyState
        icon={Users}
        title="Nessun cliente trovato"
        subtitle={q ? `Nessun risultato per "${q}"` : "Aggiungi il tuo primo cliente"}
        action={!q ? (
          <Link href={`/${slug}/clients/new`} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)]" style={{ minHeight: "unset" }}>
            <Plus className="w-4 h-4" strokeWidth={2.5} />Nuovo Cliente
          </Link>
        ) : undefined}
      />
    </div>
  );

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/${slug}/clients/${c.id}`}
            className="mobile-card flex items-center gap-3"
            style={{ minHeight: "unset" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-[15px]"
              style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}
            >
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-fg truncate">{c.name}</p>
              <p className="text-[12px] text-fg-3 truncate">{c.company ?? c.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-[11px] text-fg-3">
                  <FileCheck className="w-3 h-3" strokeWidth={1.6} />
                  {c._count.contracts} contratti
                </span>
                <span className="flex items-center gap-1 text-[11px] text-fg-3">
                  <FileText className="w-3 h-3" strokeWidth={1.6} />
                  {c._count.invoices} fatture
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-fg-3 shrink-0" strokeWidth={1.8} />
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
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
            {clients.map((c) => (
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
                  <Link href={`/${slug}/clients/${c.id}`} className="text-[12px] font-medium text-info hover:underline" style={{ minHeight: "unset" }}>Dettagli</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const { db } = await requireCompany(slug);
  const q  = sp.q ?? "";

  return (
    <div className="space-y-4 max-w-[1100px]">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Clienti</h1>
        <Link
          href={`/${slug}/clients/new`}
          className="inline-flex items-center gap-1.5 px-3 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)] transition-colors shrink-0"
          style={{ height: 40, minHeight: "unset" }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nuovo Cliente</span>
          <span className="sm:hidden">Nuovo</span>
        </Link>
      </div>

      <Suspense fallback={null}>
        <SearchInput placeholder="Cerca per nome, email, azienda…" className="w-full md:max-w-sm" />
      </Suspense>

      <Suspense fallback={<div className="text-center py-10 text-[13px] text-fg-3">Caricamento…</div>}>
        <ClientsList db={db} slug={slug} q={q} />
      </Suspense>
    </div>
  );
}
