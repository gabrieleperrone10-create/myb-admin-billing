"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Plus, Filter } from "lucide-react";

const SECTIONS: Record<string, string> = {
  dashboard: "Dashboard",
  clients:   "Clienti",
  products:  "Prodotti & Servizi",
  contracts: "Contratti",
  deposits:  "Depositi",
  invoices:  "Fatture",
  payments:  "Pagamenti",
  expenses:  "Spese",
  settings:  "Impostazioni",
};

const PAGE_CTA: Record<string, { label: string; href: string }> = {
  dashboard: { label: "Nuova fattura", href: "/invoices/new" },
  invoices:  { label: "Nuova fattura", href: "/invoices/new" },
  clients:   { label: "Nuovo cliente", href: "/clients/new" },
  contracts: { label: "Nuovo contratto", href: "/contracts/new" },
  products:  { label: "Nuovo prodotto", href: "/products/new" },
  expenses:  { label: "Nuova spesa",    href: "/expenses/new" },
};

export default function Topbar() {
  const pathname = usePathname();
  const parts    = pathname.split("/").filter(Boolean);
  const rootKey  = parts[0] ?? "dashboard";
  const section  = SECTIONS[rootKey] ?? "—";
  const isNew    = parts[1] === "new";
  const isDetail = parts.length > 1 && !isNew;
  const cta      = PAGE_CTA[rootKey];

  const now = new Date();
  const monthYear = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

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
        <span className="capitalize">{monthYear}</span>
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Period/filter display */}
        <button
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
        >
          <Filter className="w-3 h-3" strokeWidth={1.6} />
          <span className="capitalize">{monthYear}</span>
        </button>

        {/* Export */}
        <button
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
        >
          <Download className="w-3 h-3" strokeWidth={1.6} />
          Esporta
        </button>

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
