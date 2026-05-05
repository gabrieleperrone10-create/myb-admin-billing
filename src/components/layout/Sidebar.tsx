"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Package, FileText, CreditCard,
  Wallet, FileCheck, Settings, Search, BarChart3, FolderOpen, Users2, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

const operazioni = [
  { href: "/dashboard",  label: "Dashboard",         icon: LayoutDashboard },
  { href: "/clients",    label: "Clienti",            icon: Users },
  { href: "/products",   label: "Prodotti & Servizi", icon: Package },
  { href: "/contracts",  label: "Contratti",          icon: FileCheck },
  { href: "/deposits",   label: "Depositi",           icon: Wallet },
  { href: "/invoices",   label: "Fatture",            icon: FileText },
  { href: "/payments",   label: "Pagamenti",          icon: CreditCard },
  { href: "/expenses",   label: "Spese",              icon: Receipt },
];

const prossimamente = [
  { label: "Produzione",     icon: FolderOpen },
  { label: "Progetti",       icon: FolderOpen },
  { label: "Team & Reparti", icon: Users2 },
  { label: "Statistiche",    icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-full"
      style={{ backgroundColor: "#ffffff", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 h-[52px] shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-[22px] h-[22px] rounded-[4px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--fg)" }}
        >
          <span className="text-[11px] font-semibold leading-none select-none" style={{ color: "#fff" }}>G</span>
        </div>
        <span className="text-[14px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>
          Gestionale
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] text-left transition-colors"
          style={{ backgroundColor: "var(--subtle)" }}
          aria-label="Cerca (⌘K)"
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} strokeWidth={1.6} />
          <span className="flex-1 text-[12px]" style={{ color: "var(--fg-3)" }}>Cerca...</span>
          <kbd
            className="font-mono text-[10px] rounded px-1 py-0.5 leading-none"
            style={{ color: "var(--fg-3)", backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        <div>
          <p
            className="font-mono text-[9px] uppercase px-2 mb-1.5 select-none"
            style={{ color: "var(--fg-3)", letterSpacing: "0.14em" }}
          >
            Operazioni
          </p>
          <div className="space-y-0.5">
            {operazioni.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-[6px] rounded-[6px] text-[13px] transition-colors duration-100",
                    active ? "font-medium" : ""
                  )}
                  style={{
                    backgroundColor: active ? "var(--subtle)" : "transparent",
                    color: active ? "var(--fg)" : "var(--fg-2)",
                    borderLeft: active ? "2px solid var(--info)" : "2px solid transparent",
                    paddingLeft: "8px",
                  }}
                >
                  <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.6} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p
            className="font-mono text-[9px] uppercase px-2 mb-1.5 select-none"
            style={{ color: "var(--fg-3)", letterSpacing: "0.14em" }}
          >
            Prossimamente
          </p>
          <div className="space-y-0.5">
            {prossimamente.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-[6px] text-[13px] cursor-default"
                style={{ color: "var(--fg-3)", paddingLeft: "10px" }}
              >
                <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.6} />
                <span className="flex-1">{label}</span>
                <span
                  className="font-mono text-[9px] uppercase"
                  style={{ color: "var(--fg-3)", letterSpacing: "0.08em" }}
                >
                  SOON
                </span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-2.5 space-y-0.5" style={{ borderTop: "1px solid var(--border)" }}>
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-[6px] text-[13px] transition-colors"
          style={{
            backgroundColor: pathname === "/settings" ? "var(--subtle)" : "transparent",
            color: pathname === "/settings" ? "var(--fg)" : "var(--fg-2)",
            borderLeft: pathname === "/settings" ? "2px solid var(--info)" : "2px solid transparent",
            paddingLeft: "8px",
          }}
        >
          <Settings className="w-[15px] h-[15px] shrink-0" strokeWidth={1.6} />
          Impostazioni
        </Link>
        <div className="flex items-center gap-2.5 px-2.5 py-[6px]">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "oklch(0.85 0.04 80)" }}
          >
            <span className="text-[10px] font-semibold select-none" style={{ color: "var(--fg)" }}>N</span>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium leading-none truncate" style={{ color: "var(--fg)" }}>Nicolò</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: "var(--fg-3)" }}>Admin · MYB</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
