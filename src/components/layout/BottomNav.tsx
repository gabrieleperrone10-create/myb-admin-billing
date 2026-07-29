"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Users, Receipt, Grid2X2,
  Package, FileCheck, Wallet, CreditCard, Zap, BookOpen, FileMinus,
  GraduationCap, CalendarDays, UsersRound, ScrollText, Settings, X,
  Shield, UserCog, Trophy,
} from "lucide-react";
import type { AppSection } from "@prisma/client";

const SECTION_MAP: Record<string, AppSection> = {
  "/dashboard":       "DASHBOARD",
  "/invoices":        "INVOICES",
  "/credit-notes":    "CREDIT_NOTES",
  "/clients":         "CLIENTS",
  "/expenses":        "EXPENSES",
  "/products":        "PRODUCTS",
  "/contracts":       "CONTRACTS",
  "/deposits":        "DEPOSITS",
  "/payments":        "PAYMENTS",
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

const MAIN_NAV = [
  { href: "/dashboard", label: "Home",    icon: LayoutDashboard, section: "DASHBOARD" as AppSection },
  { href: "/clients",   label: "Clienti", icon: Users,           section: "CLIENTS" as AppSection },
  { href: "/invoices",  label: "Fatture", icon: FileText,        section: "INVOICES" as AppSection },
  { href: "/expenses",  label: "Spese",   icon: Receipt,         section: "EXPENSES" as AppSection },
];

const MORE_SECTIONS = [
  {
    title: "Amministrazione",
    items: [
      { href: "/credit-notes", label: "Note credito",    icon: FileMinus,  section: "CREDIT_NOTES" as AppSection },
      { href: "/contracts", label: "Contratti",          icon: FileCheck,  section: "CONTRACTS" as AppSection },
      { href: "/payments",  label: "Pagamenti",          icon: CreditCard, section: "PAYMENTS" as AppSection },
      { href: "/deposits",  label: "Depositi",           icon: Wallet,     section: "DEPOSITS" as AppSection },
      { href: "/products",  label: "Prodotti",           icon: Package,    section: "PRODUCTS" as AppSection },
    ],
  },
  {
    title: "Operazioni",
    items: [
      { href: "/objectives", label: "Obiettivi", icon: Trophy,      section: "OBJECTIVES" as AppSection },
      { href: "/events",     label: "Eventi",    icon: CalendarDays, section: "EVENTS" as AppSection },
      { href: "/team",       label: "Team",      icon: UsersRound,   section: "TEAM" as AppSection },
    ],
  },
  {
    title: "Organizzazione",
    items: [
      { href: "/academy",   label: "Academy",   icon: GraduationCap, section: "ACADEMY" as AppSection },
      { href: "/sop",       label: "SOP",       icon: ScrollText,    section: "SOP" as AppSection },
      { href: "/knowledge", label: "Knowledge", icon: BookOpen,      section: "KNOWLEDGE" as AppSection },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/automations",    label: "Automazioni",  icon: Zap,     section: "AUTOMATIONS" as AppSection },
      { href: "/settings",       label: "Impostazioni", icon: Settings, section: "SETTINGS" as AppSection },
      { href: "/settings/users", label: "Utenti",       icon: UserCog, section: "USERS" as AppSection },
      { href: "/settings/roles", label: "Ruoli",        icon: Shield,  section: "USERS" as AppSection },
    ],
  },
];

export function BottomNav({ allowedSections = [] }: { allowedSections?: AppSection[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const allowed = new Set(allowedSections);
  const hasAny = allowedSections.length > 0;

  function isAllowed(href: string) {
    if (!hasAny) return true;
    const section = SECTION_MAP[href];
    if (!section) return true;
    return allowed.has(section);
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const visibleMain = MAIN_NAV.filter(i => isAllowed(i.href));
  const visibleMore = MORE_SECTIONS.map(s => ({
    ...s,
    items: s.items.filter(i => isAllowed(i.href)),
  })).filter(s => s.items.length > 0);

  const moreActive = visibleMore.flatMap(s => s.items).some(i => isActive(i.href));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          height: "calc(56px + env(safe-area-inset-bottom))",
        }}
      >
        {visibleMain.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 transition-colors"
              style={{ minHeight: "unset", minWidth: "unset" }}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={active ? 2.2 : 1.6}
                style={{ color: active ? "var(--info)" : "var(--fg-3)" }}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-wide"
                style={{
                  color: active ? "var(--info)" : "var(--fg-3)",
                  fontWeight: active ? 600 : 400,
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 transition-colors"
          style={{ minHeight: "unset", minWidth: "unset", backgroundColor: "transparent", border: "none" }}
        >
          {moreOpen
            ? <X className="w-5 h-5" strokeWidth={1.8} style={{ color: "var(--info)" }} />
            : <Grid2X2 className="w-5 h-5" strokeWidth={moreActive ? 2.2 : 1.6} style={{ color: moreActive ? "var(--info)" : "var(--fg-3)" }} />
          }
          <span
            className="font-mono text-[9px] uppercase"
            style={{
              color: moreOpen || moreActive ? "var(--info)" : "var(--fg-3)",
              fontWeight: moreOpen || moreActive ? 600 : 400,
              letterSpacing: "0.06em",
            }}
          >
            Altro
          </span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 animate-fade-in"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 animate-slide-up rounded-t-[20px] overflow-hidden"
            style={{
              backgroundColor: "var(--surface)",
              paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border)" }} />
            </div>

            <div className="px-4 pb-4 space-y-5">
              {visibleMore.map(section => (
                <div key={section.title}>
                  <p
                    className="font-mono text-[10px] uppercase mb-2 px-1"
                    style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}
                  >
                    {section.title}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map(({ href, label, icon: Icon }) => {
                      const active = isActive(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          className="flex flex-col items-center gap-2 py-3 px-2 rounded-[12px] transition-colors"
                          style={{
                            backgroundColor: active ? "var(--info-soft)" : "var(--subtle)",
                            border: `1px solid ${active ? "var(--info)" : "var(--border)"}`,
                            minHeight: "unset",
                            minWidth: "unset",
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            strokeWidth={1.8}
                            style={{ color: active ? "var(--info)" : "var(--fg-2)" }}
                          />
                          <span
                            className="text-[11px] font-medium text-center leading-tight"
                            style={{ color: active ? "var(--info)" : "var(--fg-2)" }}
                          >
                            {label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
