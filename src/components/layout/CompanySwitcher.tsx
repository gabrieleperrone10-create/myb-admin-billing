"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Check, Building2, Plus } from "lucide-react";
import { companyPath } from "@/lib/paths";

type CompanyOption = { slug: string; name: string };

export function CompanySwitcher({
  companies,
  currentSlug,
  currentName,
}: {
  companies: CompanyOption[];
  currentSlug: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-4 w-full transition-colors"
        style={{ borderBottom: "1px solid var(--border)", height: "var(--topbar-h)", minHeight: "unset" }}
      >
        <div
          className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--fg)" }}
        >
          <span className="text-[11px] font-bold leading-none select-none" style={{ color: "var(--surface)" }}>
            {currentName[0]?.toUpperCase() ?? "A"}
          </span>
        </div>
        <span
          className="text-[13px] font-semibold truncate flex-1 text-left"
          style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}
        >
          {currentName}
        </span>
        {companies.length > 1 && (
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} strokeWidth={1.8} />
        )}
      </button>

      {open && (
        <div
          className="absolute left-2 right-2 top-full mt-1 rounded-[var(--r-lg)] py-1 z-50 animate-scale-in"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {companies.map(c => (
            <Link
              key={c.slug}
              href={companyPath(c.slug, "/dashboard")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
              style={{
                color: c.slug === currentSlug ? "var(--fg)" : "var(--fg-2)",
                fontWeight: c.slug === currentSlug ? 600 : 400,
                minHeight: "unset",
              }}
            >
              <span
                className="w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0 text-[9px] font-bold"
                style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}
              >
                {c.name[0]?.toUpperCase() ?? "A"}
              </span>
              <span className="flex-1 truncate">{c.name}</span>
              {c.slug === currentSlug && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--info)" }} />}
            </Link>
          ))}

          <div style={{ height: 1, backgroundColor: "var(--border)", margin: "4px 8px" }} />

          <Link
            href={companyPath(currentSlug, "/settings/companies")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: "var(--fg-2)", minHeight: "unset" }}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />
            Gestisci aziende
          </Link>
          <Link
            href={companyPath(currentSlug, "/settings/companies")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors"
            style={{ color: "var(--info)", minHeight: "unset" }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            Nuova azienda
          </Link>
        </div>
      )}
    </div>
  );
}
