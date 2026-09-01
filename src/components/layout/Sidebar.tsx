"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Package, FileText, CreditCard,
  Wallet, FileCheck, Settings, Search, Receipt, FileMinus,
  BookOpen, Zap, GraduationCap, CalendarDays, UsersRound, ScrollText,
  Shield, UserCog, User, ChevronDown, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import SearchModal from "./SearchModal";
import { useCompanySlug } from "@/lib/useCompany";
import { companyPath, stripCompany } from "@/lib/paths";
import type { AppSection } from "@prisma/client";

const SECTION_MAP: Record<string, AppSection> = {
  "/dashboard":       "DASHBOARD",
  "/clients":         "CLIENTS",
  "/products":        "PRODUCTS",
  "/contracts":       "CONTRACTS",
  "/deposits":        "DEPOSITS",
  "/invoices":        "INVOICES",
  "/credit-notes":    "CREDIT_NOTES",
  "/payments":        "PAYMENTS",
  "/expenses":        "EXPENSES",
  "/automations":     "AUTOMATIONS",
  "/knowledge":       "KNOWLEDGE",
  "/team":            "TEAM",
  "/academy":         "ACADEMY",
  "/objectives":      "OBJECTIVES",
  "/events":          "EVENTS",
  "/sop":             "SOP",
  "/settings":        "SETTINGS",
  "/settings/users":  "USERS",
  "/settings/roles":  "USERS",
};

const amministrazione = [
  { href: "/clients",   label: "Clienti",           icon: Users },
  { href: "/contracts", label: "Contratti",          icon: FileCheck },
  { href: "/invoices",  label: "Fatture",            icon: FileText },
  { href: "/credit-notes", label: "Note di credito", icon: FileMinus },
  { href: "/payments",  label: "Pagamenti",          icon: CreditCard },
  { href: "/expenses",  label: "Spese",              icon: Receipt },
  { href: "/deposits",  label: "Depositi",           icon: Wallet },
  { href: "/products",  label: "Prodotti & Servizi", icon: Package },
];

const operazioni = [
  { href: "/objectives", label: "Obiettivi",  icon: Trophy },
  { href: "/events",     label: "Eventi",     icon: CalendarDays },
  { href: "/team",       label: "Team",       icon: UsersRound },
];

const organizzazione = [
  { href: "/academy",   label: "Academy",        icon: GraduationCap },
  { href: "/sop",       label: "SOP",            icon: ScrollText },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
];

const sistema = [
  { href: "/automations",  label: "Automazioni",  icon: Zap },
  { href: "/settings",     label: "Impostazioni", icon: Settings },
  { href: "/settings/users", label: "Utenti",     icon: UserCog },
  { href: "/settings/roles", label: "Ruoli",      icon: Shield },
];

export default function Sidebar({ allowedSections = [], companyName = "Azienda" }: { allowedSections?: AppSection[]; companyName?: string }) {
  const slug = useCompanySlug();
  const pathname = stripCompany(usePathname());
  const { user } = useUser();
  const allowed = new Set(allowedSections);
  const hasAny = allowedSections.length > 0;

  const [searchOpen, setSearchOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("sidebar-collapsed") ?? "{}"); } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed)); } catch {}
  }, [collapsed]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  function toggle(key: string) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }));
  }

  function isVisible(href: string) {
    if (!hasAny) return true;
    const section = SECTION_MAP[href];
    if (!section) return true;
    if (href === "/settings") return allowed.has("SETTINGS");
    return allowed.has(section);
  }

  const visibleAmm = amministrazione.filter(i => isVisible(i.href));
  const visibleOp  = operazioni.filter(i => isVisible(i.href));
  const visibleOrg = organizzazione.filter(i => isVisible(i.href));
  const visibleSis = sistema.filter(i => isVisible(i.href));

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Utente" : "—";
  const initials = displayName[0]?.toUpperCase() ?? "U";

  return (
    <>
    <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    <aside
      className="hidden md:flex w-[220px] shrink-0 flex-col h-full"
      style={{ backgroundColor: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", height: "var(--topbar-h)" }}
      >
        <div
          className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--fg)" }}
        >
          <span className="text-[11px] font-bold leading-none select-none" style={{ color: "var(--surface)" }}>{companyName[0]?.toUpperCase() ?? "A"}</span>
        </div>
        <span className="text-[13px] font-semibold truncate" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>
          {companyName}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--r-md)] text-left transition-colors"
          style={{ backgroundColor: "var(--subtle)", minHeight: "unset" }}
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
        {/* Dashboard solo */}
        <div>
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} pathname={pathname} accentColor="var(--fg)" slug={slug} />
        </div>

        {visibleAmm.length > 0 && (
          <NavSection title="Amministrazione" sectionKey="amm" items={visibleAmm} pathname={pathname} accentColor="var(--info)" collapsed={!!collapsed["amm"]} onToggle={() => toggle("amm")} slug={slug} />
        )}
        {visibleOp.length > 0 && (
          <NavSection title="Operazioni" sectionKey="op" items={visibleOp} pathname={pathname} accentColor="#10b981" collapsed={!!collapsed["op"]} onToggle={() => toggle("op")} slug={slug} />
        )}
        {visibleOrg.length > 0 && (
          <NavSection title="Organizzazione" sectionKey="org" items={visibleOrg} pathname={pathname} accentColor="#8b5cf6" collapsed={!!collapsed["org"]} onToggle={() => toggle("org")} slug={slug} />
        )}
      </nav>

      {/* Footer */}
      <div className="px-2.5 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Sistema collapsible header */}
        {visibleSis.length > 0 && (
          <div className="mb-0.5">
            <button
              onClick={() => toggle("sis")}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-[var(--r-md)] transition-colors"
              style={{ minHeight: "unset", color: "var(--fg-3)" }}
            >
              <span className="font-mono text-[9px] uppercase flex-1 text-left select-none" style={{ letterSpacing: "0.14em" }}>
                Sistema
              </span>
              <ChevronDown
                className="w-3 h-3 transition-transform duration-200"
                strokeWidth={2}
                style={{ transform: collapsed["sis"] ? "rotate(-90deg)" : "rotate(0deg)" }}
              />
            </button>
            {!collapsed["sis"] && (
              <div className="space-y-0.5 mt-0.5">
                {visibleSis.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== "/settings" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={companyPath(slug, href)}
                      className={cn("flex items-center gap-2.5 px-2.5 py-[6px] rounded-[var(--r-md)] text-[13px] transition-colors", active ? "font-medium" : "")}
                      style={{
                        backgroundColor: active ? "var(--subtle)" : "transparent",
                        color: active ? "var(--fg)" : "var(--fg-2)",
                        borderLeft: active ? "2px solid var(--fg-3)" : "2px solid transparent",
                        paddingLeft: "8px",
                        minHeight: "unset",
                      }}
                    >
                      <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.6} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "var(--border)", margin: "6px 0" }} />

        {/* User row */}
        <Link
          href={companyPath(slug, "/profile")}
          className="flex items-center gap-2.5 px-2.5 py-[6px] rounded-[var(--r-md)] transition-colors group"
          style={{ minHeight: "unset" }}
        >
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "oklch(0.85 0.04 80)" }}
            >
              <span className="text-[11px] font-semibold select-none" style={{ color: "var(--fg)" }}>{initials}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium leading-none truncate" style={{ color: "var(--fg)" }}>{displayName}</p>
            <p className="text-[10px] leading-none mt-0.5 flex items-center gap-1" style={{ color: "var(--fg-3)" }}>
              <User className="w-2.5 h-2.5" />
              Profilo
            </p>
          </div>
          <ThemeToggle />
        </Link>
      </div>
    </aside>
    </>
  );
}

function NavItem({
  href, label, icon: Icon, pathname, accentColor, slug,
}: {
  href: string; label: string; icon: React.FC<{ className?: string; strokeWidth?: number }>;
  pathname: string; accentColor: string; slug: string;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={companyPath(slug, href)}
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2.5 px-2.5 py-[6px] rounded-[var(--r-md)] text-[13px] transition-colors duration-100", active ? "font-medium" : "")}
      style={{
        backgroundColor: active ? "var(--subtle)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-2)",
        borderLeft: active ? `2px solid ${accentColor}` : "2px solid transparent",
        paddingLeft: "8px",
        minHeight: "unset",
      }}
    >
      <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.6} />
      {label}
    </Link>
  );
}

function NavSection({
  title, sectionKey, items, pathname, accentColor, collapsed, onToggle, slug,
}: {
  title: string;
  sectionKey: string;
  items: { href: string; label: string; icon: React.FC<{ className?: string; strokeWidth?: number }> }[];
  pathname: string;
  accentColor: string;
  collapsed: boolean;
  onToggle: () => void;
  slug: string;
}) {
  void sectionKey;
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-[var(--r-md)] transition-colors"
        style={{ minHeight: "unset", color: "var(--fg-3)" }}
      >
        <span className="font-mono text-[9px] uppercase flex-1 text-left select-none" style={{ letterSpacing: "0.14em" }}>
          {title}
        </span>
        <ChevronDown
          className="w-3 h-3 transition-transform duration-200"
          strokeWidth={2}
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        />
      </button>
      {!collapsed && (
        <div className="space-y-0.5 mt-0.5">
          {items.map(({ href, label, icon: Icon }) => (
            <NavItem key={href} href={href} label={label} icon={Icon} pathname={pathname} accentColor={accentColor} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}
