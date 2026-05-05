import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const TYPE_CONFIG: Record<string, { label: string }> = {
  SUBSCRIPTION: { label: "Abbonamento" },
  COACHING:     { label: "Coaching" },
  CONSULTING:   { label: "Consulenza" },
  DIGITAL:      { label: "Prodotto Digitale" },
};

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { _count: { select: { contracts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Prodotti & Servizi</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">{products.length} prodotti</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Nuovo Prodotto
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-surface border border-border rounded-[var(--r-lg)]">
          <EmptyState
            icon={Package}
            title="Nessun prodotto ancora"
            subtitle="Aggiungi i tuoi servizi e prodotti per creare contratti"
            action={
              <Link href="/products/new" className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors">
                <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nuovo Prodotto
              </Link>
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
