export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

const TYPE_CONFIG: Record<string, { label: string }> = {
  SUBSCRIPTION: { label: "Abbonamento" },
  COACHING:     { label: "Coaching" },
  CONSULTING:   { label: "Consulenza" },
  DIGITAL:      { label: "Prodotto Digitale" },
};

const TYPE_OPTIONS = [
  { value: "",             label: "Tutti" },
  { value: "SUBSCRIPTION", label: "Abbonamenti" },
  { value: "COACHING",     label: "Coaching" },
  { value: "CONSULTING",   label: "Consulenza" },
  { value: "DIGITAL",      label: "Digitale" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; active?: string }>;
}) {
  const sp     = await searchParams;
  const q      = sp.q ?? "";
  const type   = sp.type ?? "";
  const active = sp.active;

  const products = await prisma.product.findMany({
    where: {
      ...(type ? { type: type as never } : {}),
      ...(active === "1" ? { active: true } : active === "0" ? { active: false } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ]} : {}),
    },
    include: { _count: { select: { contracts: true } } },
    orderBy: { createdAt: "desc" },
  });

  const filterLink = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...extra });
    return `/products?${p.toString()}`;
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Prodotti & Servizi</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{products.length} risultati</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Nuovo Prodotto
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per nome o descrizione…" className="w-64" />
        </Suspense>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_OPTIONS.map(opt => (
            <Link
              key={opt.value}
              href={filterLink(opt.value ? { type: opt.value } : {})}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
              style={{
                backgroundColor: type === opt.value ? "var(--fg)" : "transparent",
                color: type === opt.value ? "#ffffff" : "var(--fg-2)",
                borderColor: type === opt.value ? "var(--fg)" : "var(--border)",
              }}
            >
              {opt.label}
            </Link>
          ))}
          <Link
            href={filterLink({ active: active === "1" ? "" : "1" })}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
            style={{
              backgroundColor: active === "1" ? "#3b9e6a" : "transparent",
              color: active === "1" ? "#ffffff" : "var(--fg-2)",
              borderColor: active === "1" ? "#3b9e6a" : "var(--border)",
            }}
          >
            Solo attivi
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-surface border border-border rounded-[var(--r-lg)]">
          <EmptyState
            icon={Package}
            title="Nessun prodotto trovato"
            subtitle={q ? `Nessun risultato per "${q}"` : "Aggiungi i tuoi servizi e prodotti per creare contratti"}
            action={
              !q ? (
                <Link href="/products/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nuovo Prodotto
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-[var(--r-lg)] p-5 hover:border-fg-3/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="info">{TYPE_CONFIG[p.type]?.label ?? p.type}</Badge>
                <span
                  className={`w-2 h-2 rounded-full mt-1 shrink-0 ${p.active ? "bg-ok" : "bg-fg-3/40"}`}
                  title={p.active ? "Attivo" : "Inattivo"}
                />
              </div>
              <h3 className="text-[14px] font-medium text-fg mb-1">{p.name}</h3>
              {p.description && (
                <p className="text-[12px] text-fg-3 mb-3 line-clamp-2">{p.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-subtle">
                <span className="font-mono text-[15px] font-semibold text-fg tabular-nums">
                  {formatCurrency(p.basePrice)}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-fg-3">{p._count.contracts} contratti</span>
                  <Link href={`/products/${p.id}`} className="text-[12px] font-medium text-info hover:underline">
                    Modifica
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
