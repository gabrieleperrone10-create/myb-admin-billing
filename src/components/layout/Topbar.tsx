"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Download, Plus, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const SECTIONS: Record<string, string> = {
  dashboard:   "Dashboard",
  clients:     "Clienti",
  products:    "Prodotti & Servizi",
  contracts:   "Contratti",
  deposits:    "Depositi",
  invoices:    "Fatture",
  payments:    "Pagamenti",
  expenses:    "Spese",
  automations: "Automazioni",
  knowledge:   "Knowledge Base",
  settings:    "Impostazioni",
};

const PAGE_CTA: Record<string, { label: string; href: string }> = {
  dashboard: { label: "Nuova fattura",   href: "/invoices/new" },
  invoices:  { label: "Nuova fattura",   href: "/invoices/new" },
  clients:   { label: "Nuovo cliente",   href: "/clients/new" },
  contracts: { label: "Nuovo contratto", href: "/contracts/new" },
  products:  { label: "Nuovo prodotto",  href: "/products/new" },
  expenses:  { label: "Nuova spesa",     href: "/expenses/new" },
};

const EXPORTABLE: Record<string, string> = {
  clients:   "clients",
  invoices:  "invoices",
  payments:  "payments",
  expenses:  "expenses",
  products:  "products",
  contracts: "contracts",
  deposits:  "deposits",
};

const PERIOD_OPTIONS = [
  { label: "Oggi",          value: "day" },
  { label: "Questa settimana", value: "week" },
  { label: "Questo mese",  value: "month" },
  { label: "Quest'anno",   value: "year" },
  { label: "Da sempre",    value: "all" },
];

export default function Topbar() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const router      = useRouter();
  const parts       = pathname.split("/").filter(Boolean);
  const rootKey     = parts[0] ?? "dashboard";
  const section     = SECTIONS[rootKey] ?? "—";
  const isNew       = parts[1] === "new";
  const isDetail    = parts.length > 1 && !isNew;
  const cta         = PAGE_CTA[rootKey];
  const exportEntity = EXPORTABLE[rootKey];

  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  const now       = new Date();
  const currentPeriod = searchParams.get("period") ?? "month";
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === currentPeriod)?.label
    ?? now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function setPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
    setPeriodOpen(false);
  }

  function handleExport() {
    if (!exportEntity) return;
    const params = new URLSearchParams(searchParams.toString());
    window.location.href = `/api/export/${exportEntity}?${params.toString()}`;
  }

  return (
    <header
      className="h-[52px] shrink-0 flex items-center px-7 gap-3"
      style={{ backgroundColor: "#ffffff", borderBottom: "1px solid var(--border)" }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-mono text-[12px] flex-1 min-w-0" style={{ color: "var(--fg-3)" }}>
        <span style={{ color: "var(--fg-2)" }}>{section}</span>
        {isNew    && <><span style={{ opacity: 0.4 }}>›</span><span style={{ color: "var(--fg-2)" }}>Nuovo</span></>}
        {isDetail && <><span style={{ opacity: 0.4 }}>›</span><span style={{ color: "var(--fg-2)" }}>Dettaglio</span></>}
        <span style={{ opacity: 0.3, margin: "0 4px" }}>·</span>
        <span className="capitalize">{now.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Period filter dropdown */}
        <div className="relative hidden sm:block" ref={periodRef}>
          <button
            onClick={() => setPeriodOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
          >
            <span className="capitalize">{periodLabel}</span>
            <ChevronDown className="w-3 h-3" strokeWidth={1.8} />
          </button>

          {periodOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-[8px] py-1 z-50 min-w-[160px]"
              style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
            >
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="w-full text-left px-3 py-1.5 text-[12px] transition-colors"
                  style={{
                    color: currentPeriod === opt.value ? "var(--fg)" : "var(--fg-2)",
                    fontWeight: currentPeriod === opt.value ? 500 : 400,
                    backgroundColor: currentPeriod === opt.value ? "var(--subtle)" : "transparent",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        {exportEntity && (
          <button
            onClick={handleExport}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
          >
            <Download className="w-3 h-3" strokeWidth={1.6} />
            Esporta CSV
          </button>
        )}

        {/* Primary CTA */}
        {cta && (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12px] font-medium transition-colors"
            style={{ backgroundColor: "var(--fg)", color: "#ffffff" }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            {cta.label}
          </Link>
        )}
      </div>
    </header>
  );
}
