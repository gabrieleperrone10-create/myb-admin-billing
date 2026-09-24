"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus, Settings, Upload, Tag as TagIcon, SlidersHorizontal, ChevronDown } from "lucide-react";
import { companyPath } from "@/lib/paths";
import { CONTACT_TABS, type ContactTab, type ContactSortKey } from "@/lib/crm/contactQuery";
import type { ContactFilters } from "@/lib/crm/types";
import { SearchInput } from "@/components/ui/SearchInput";
import { buildHref } from "./url";
import FiltersPopover from "./FiltersPopover";
import ColumnPicker from "./ColumnPicker";
import SavedViewsMenu from "./SavedViewsMenu";
import type { MemberOption, TagOption, CustomFieldDefLite, SavedViewLite } from "./types";

export default function ContactsToolbar({
  slug,
  tab,
  tabCounts,
  filters,
  columns,
  sort,
  dir,
  tags,
  members,
  customFieldDefs,
  savedViews,
  sourceOptions,
}: {
  slug: string;
  tab: ContactTab;
  tabCounts: Record<ContactTab, number>;
  filters: ContactFilters;
  columns: string[];
  sort: ContactSortKey;
  dir: "asc" | "desc";
  tags: TagOption[];
  members: MemberOption[];
  customFieldDefs: CustomFieldDefLite[];
  savedViews: SavedViewLite[];
  sourceOptions: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-[22px] md:text-[24px] font-bold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>Contatti</h1>
        <div className="flex items-center gap-2">
          <Link
            href={companyPath(slug, "/contacts/import")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg-2)" }}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importa CSV</span>
          </Link>
          <SettingsMenu slug={slug} />
          <Link
            href={companyPath(slug, "/contacts/new")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-semibold text-white"
            style={{ backgroundColor: "var(--fg)" }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Nuovo contatto</span>
            <span className="sm:hidden">Nuovo</span>
          </Link>
        </div>
      </div>

      {/* Tab rapidi */}
      <div className="flex items-center gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {CONTACT_TABS.map(t => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={buildHref(pathname, searchParams, { tab: t.key === "all" ? null : t.key })}
              className="px-3 py-2 text-[13px] whitespace-nowrap -mb-px inline-flex items-center gap-1.5"
              style={{
                color: active ? "var(--fg)" : "var(--fg-3)",
                borderBottom: active ? "2px solid var(--fg)" : "2px solid transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>
                {tabCounts[t.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SearchInput placeholder="Cerca per nome, email, telefono, azienda…" className="w-full sm:w-72" />
        <FiltersPopover filters={filters} tags={tags} members={members} customFieldDefs={customFieldDefs} sourceOptions={sourceOptions} />
        <ColumnPicker columns={columns} customFieldDefs={customFieldDefs} />
        <SavedViewsMenu slug={slug} views={savedViews} filters={filters} columns={columns} sort={sort} dir={dir} />
      </div>
    </div>
  );
}

function SettingsMenu({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg-2)" }}
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Impostazioni</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1.5 w-[220px] rounded-[var(--r-lg)] p-1.5 z-30"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
        >
          <Link href={companyPath(slug, "/settings/crm/fields")} className="flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-[13px] hover:bg-black/5" style={{ color: "var(--fg-2)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Campi personalizzati
          </Link>
          <Link href={companyPath(slug, "/settings/crm/tags")} className="flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-[13px] hover:bg-black/5" style={{ color: "var(--fg-2)" }}>
            <TagIcon className="w-3.5 h-3.5" /> Etichette
          </Link>
        </div>
      )}
    </div>
  );
}
