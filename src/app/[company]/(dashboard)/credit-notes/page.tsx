export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { FileMinus, Plus, ChevronRight } from "lucide-react";
import { CreditNoteStatusBadge, type CreditNoteStatus } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Suspense } from "react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "",          label: "Tutte" },
  { value: "ISSUED",    label: "Emesse" },
  { value: "SENT",      label: "Inviate" },
  { value: "CANCELLED", label: "Annullate" },
];

export default async function CreditNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const { db } = await requireCompany(slug);
  const q      = sp.q ?? "";
  const status = sp.status ?? "";

  const creditNotes = await db.creditNote.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q ? { OR: [
        { number: { contains: q, mode: "insensitive" } },
        { clientName: { contains: q, mode: "insensitive" } },
        { originalInvoiceNumber: { contains: q, mode: "insensitive" } },
      ]} : {}),
    },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div className="space-y-4 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[24px] font-bold text-fg" style={{ letterSpacing: "-0.02em" }}>Note di credito</h1>
          <p className="text-[12px] text-fg-3 mt-0.5">{creditNotes.length} risultati</p>
        </div>
        <Link
          href={`/${slug}/credit-notes/new`}
          className="inline-flex items-center gap-1.5 px-3 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)] transition-colors shrink-0"
          style={{ height: 40, minHeight: "unset" }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nuova nota di credito</span>
          <span className="sm:hidden">Nuova</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Suspense fallback={null}>
          <SearchInput placeholder="Cerca per numero, cliente o fattura…" className="w-full md:w-72" />
        </Suspense>
        <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {STATUS_OPTIONS.map(opt => (
            <Link
              key={opt.value}
              href={`/${slug}/credit-notes?${new URLSearchParams({ ...(q ? { q } : {}), ...(opt.value ? { status: opt.value } : {}) }).toString()}`}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors"
              style={{
                backgroundColor: status === opt.value ? "var(--fg)" : "var(--surface)",
                color: status === opt.value ? "var(--surface)" : "var(--fg-2)",
                borderColor: status === opt.value ? "var(--fg)" : "var(--border)",
                minHeight: "unset",
              }}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {creditNotes.length === 0 ? (
        <EmptyState
          icon={FileMinus}
          title="Nessuna nota di credito trovata"
          subtitle={q || status ? "Prova a modificare i filtri" : "Genera la tua prima nota di credito"}
          action={!q && !status ? (
            <Link href={`/${slug}/credit-notes/new`} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)]" style={{ minHeight: "unset" }}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />Nuova nota di credito
            </Link>
          ) : undefined}
        />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {creditNotes.map((cn) => (
              <Link
                key={cn.id}
                href={`/${slug}/credit-notes/${cn.id}`}
                className="mobile-card flex items-center gap-3"
                style={{ minHeight: "unset" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] text-fg-3">{cn.number}</span>
                    <CreditNoteStatusBadge status={cn.status as CreditNoteStatus} />
                  </div>
                  <p className="text-[15px] font-semibold text-fg truncate">{cn.clientName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[11px] text-fg-3">Rif. {cn.originalInvoiceNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                    -{formatCurrency(cn.amount)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-fg-3" strokeWidth={1.8} />
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-subtle border-b border-border">
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">N°</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Cliente</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Fattura originale</th>
                  <th className="text-right px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Importo</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Emissione</th>
                  <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                    <td className="px-4 py-2.5"><Link href={`/${slug}/credit-notes/${cn.id}`} className="font-mono text-[11px] text-info hover:underline">{cn.number}</Link></td>
                    <td className="px-4 py-2.5 text-[13px] font-medium text-fg">{cn.clientName}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{cn.originalInvoiceNumber}</td>
                    <td className="px-4 py-2.5 text-right"><span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: "var(--danger)" }}>-{formatCurrency(cn.amount)}</span></td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2">{formatDate(cn.issueDate)}</td>
                    <td className="px-4 py-2.5"><CreditNoteStatusBadge status={cn.status as CreditNoteStatus} /></td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/${slug}/credit-notes/${cn.id}`} className="text-[12px] font-medium text-info hover:underline">Dettagli</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
