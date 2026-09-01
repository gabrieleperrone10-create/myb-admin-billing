"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Download, Plus, ChevronDown, ChevronLeft, Sparkles, Building2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { companyPath } from "@/lib/paths";
import { CompanyAvatar } from "./CompanyAvatar";

type CompanyOption = { slug: string; name: string; logoUrl?: string | null };

const SECTIONS: Record<string, string> = {
  dashboard:   "Dashboard",
  clients:     "Clienti",
  products:    "Prodotti & Servizi",
  contracts:   "Contratti",
  deposits:    "Depositi",
  invoices:    "Fatture",
  "credit-notes": "Note di credito",
  payments:    "Pagamenti",
  expenses:    "Spese",
  automations: "Automazioni",
  knowledge:   "Knowledge Base",
  settings:    "Impostazioni",
  team:        "Team",
  academy:     "Academy",
  events:      "Eventi",
  sop:         "SOP",
  objectives:  "Obiettivi",
  profile:     "Profilo",
};

const PAGE_CTA: Record<string, { label: string; href: string }> = {
  dashboard: { label: "Nuova fattura",   href: "/invoices/new" },
  invoices:  { label: "Nuova fattura",   href: "/invoices/new" },
  "credit-notes": { label: "Nuova nota di credito", href: "/credit-notes/new" },
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
  { label: "Oggi",             value: "day" },
  { label: "Questa settimana", value: "week" },
  { label: "Questo mese",      value: "month" },
  { label: "Quest'anno",       value: "year" },
  { label: "Da sempre",        value: "all" },
];

export default function Topbar({
  companies,
  currentCompanyName,
  currentCompanyLogoUrl,
}: {
  companies: CompanyOption[];
  currentCompanyName: string;
  currentCompanyLogoUrl?: string | null;
}) {
  const [companyOpen, setCompanyOpen] = useState(false);
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();
  // Il primo segmento e' lo slug azienda: separarlo qui mantiene invariati
  // tutti gli indici usati sotto (parts[1] per isNew/settingsSub, ecc).
  const [companySlug, ...parts] = pathname.split("/").filter(Boolean);
  const rootKey      = parts[0] ?? "dashboard";
  const isNew        = parts[1] === "new";
  const h            = (path: string) => companyPath(companySlug, path);

  const SETTINGS_SUB: Record<string, string> = { users: "Utenti", roles: "Ruoli" };
  const settingsSub = rootKey === "settings" && parts[1] ? SETTINGS_SUB[parts[1]] : null;
  const section      = settingsSub ?? SECTIONS[rootKey] ?? "—";
  const isDetail     = settingsSub
    ? parts.length > 2
    : parts.length > 1 && !isNew && rootKey !== "profile";
  const cta          = PAGE_CTA[rootKey];
  const exportEntity = EXPORTABLE[rootKey];

  const showBack = isNew || isDetail;
  const backHref = h(`/${rootKey}`);

  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  const currentPeriod = searchParams.get("period") ?? "month";
  const periodLabel   = PERIOD_OPTIONS.find(p => p.value === currentPeriod)?.label ?? "Questo mese";

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
    params.set("company", companySlug);
    window.location.href = `/api/export/${exportEntity}?${params.toString()}`;
  }

  return (
    <>
    <header
      className="shrink-0 flex items-center gap-3"
      style={{
        backgroundColor: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        height: "var(--topbar-h)",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Mobile: back button or logo */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showBack && (
          <Link
            href={backHref}
            className="md:hidden flex items-center justify-center rounded-[var(--r-md)] mr-1"
            style={{
              color: "var(--info)",
              backgroundColor: "var(--subtle)",
              width: 36,
              height: 36,
              minHeight: "unset",
              minWidth: "unset",
            }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </Link>
        )}

        {/* Desktop breadcrumb / Mobile title */}
        <div className="flex-1 min-w-0">
          {/* Desktop breadcrumb */}
          <nav className="hidden md:flex items-center gap-1.5 font-mono text-[12px]" style={{ color: "var(--fg-3)" }}>
            <span style={{ color: "var(--fg-2)" }}>{section}</span>
            {isNew    && <><span style={{ opacity: 0.4 }}>›</span><span style={{ color: "var(--fg-2)" }}>Nuovo</span></>}
            {isDetail && <><span style={{ opacity: 0.4 }}>›</span><span style={{ color: "var(--fg-2)" }}>Dettaglio</span></>}
          </nav>

          {/* Mobile title */}
          <h1
            className="md:hidden text-[17px] font-semibold truncate"
            style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}
          >
            {isNew ? `Nuovo · ${section}` : isDetail ? section : section}
          </h1>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Selettore azienda — mobile only (desktop lo ha nella sidebar) */}
        <button
          onClick={() => setCompanyOpen(true)}
          className="md:hidden flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, minHeight: "unset", minWidth: "unset" }}
          aria-label="Cambia azienda"
        >
          <CompanyAvatar name={currentCompanyName} logoUrl={currentCompanyLogoUrl} size={32} radius={8} variant="solid" />
        </button>

        {/* Period filter — desktop only */}
        <div className="relative hidden md:block" ref={periodRef}>
          <button
            onClick={() => setPeriodOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: "var(--subtle)",
              border: "1px solid var(--border)",
              color: "var(--fg-2)",
              minHeight: "unset",
            }}
          >
            <span className="capitalize">{periodLabel}</span>
            <ChevronDown className="w-3 h-3" strokeWidth={1.8} />
          </button>

          {periodOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-[var(--r-lg)] py-1 z-50 min-w-[160px] animate-scale-in"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              }}
            >
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                  style={{
                    color: currentPeriod === opt.value ? "var(--fg)" : "var(--fg-2)",
                    fontWeight: currentPeriod === opt.value ? 500 : 400,
                    backgroundColor: currentPeriod === opt.value ? "var(--subtle)" : "transparent",
                    minHeight: "unset",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export — desktop only */}
        {exportEntity && (
          <button
            onClick={handleExport}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: "var(--subtle)",
              border: "1px solid var(--border)",
              color: "var(--fg-2)",
              minHeight: "unset",
            }}
          >
            <Download className="w-3 h-3" strokeWidth={1.6} />
            CSV
          </button>
        )}

        {/* Theme toggle — desktop only (mobile is in sidebar / more drawer) */}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        {/* AI Invoice button — only on invoices section */}
        {rootKey === "invoices" && !isNew && !isDetail && (
          <Link
            href={h("/invoices/ai")}
            className="hidden md:inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--r-md)] text-[13px] font-semibold transition-colors"
            style={{
              background: "linear-gradient(135deg, #4f7deb, #8b5cf6)",
              color: "white",
              height: 36,
              minHeight: "unset",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            AI
          </Link>
        )}

        {/* Primary CTA */}
        {cta && (
          <Link
            href={h(cta.href)}
            className="inline-flex items-center justify-center gap-1.5 px-3 rounded-[var(--r-md)] text-[13px] font-semibold transition-colors"
            style={{
              backgroundColor: "var(--fg)",
              color: "var(--surface)",
              height: 36,
              minHeight: "unset",
            }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">{cta.label}</span>
            <span className="sm:hidden">Nuovo</span>
          </Link>
        )}
      </div>
    </header>

    {companyOpen && (
      <div
        className="md:hidden fixed inset-0 z-50 animate-fade-in"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={() => setCompanyOpen(false)}
      >
        <div
          className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-[20px] overflow-hidden"
          style={{
            backgroundColor: "var(--surface)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }} />
          </div>

          <p
            className="font-mono text-[10px] uppercase px-4 mb-2"
            style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}
          >
            Azienda
          </p>

          <div className="px-2 pb-2">
            {companies.map(c => (
              <Link
                key={c.slug}
                href={companyPath(c.slug, "/dashboard")}
                onClick={() => setCompanyOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--r-md)] text-[14px] transition-colors"
                style={{
                  color: c.slug === companySlug ? "var(--fg)" : "var(--fg-2)",
                  fontWeight: c.slug === companySlug ? 600 : 400,
                  minHeight: "unset",
                }}
              >
                <CompanyAvatar name={c.name} logoUrl={c.logoUrl} size={24} radius={5} variant="subtle" />
                <span className="flex-1 truncate">{c.name}</span>
                {c.slug === companySlug && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--info)" }} />}
              </Link>
            ))}
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border)", margin: "0 16px 8px" }} />

          <div className="px-2">
            <Link
              href={companyPath(companySlug, "/settings/companies")}
              onClick={() => setCompanyOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--r-md)] text-[14px] transition-colors"
              style={{ color: "var(--fg-2)", minHeight: "unset" }}
            >
              <Building2 className="w-4 h-4 shrink-0" style={{ color: "var(--fg-3)" }} />
              Gestisci aziende
            </Link>
            <Link
              href={companyPath(companySlug, "/settings/companies")}
              onClick={() => setCompanyOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--r-md)] text-[14px] font-medium transition-colors"
              style={{ color: "var(--info)", minHeight: "unset" }}
            >
              <Plus className="w-4 h-4 shrink-0" />
              Nuova azienda
            </Link>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
