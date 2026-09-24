import Link from "next/link";
import { companyPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

export const REPORT_TABS = [
  { key: "overview", label: "Panoramica" },
  { key: "funnel", label: "Imbuto per fase" },
  { key: "attribution", label: "Attribuzione" },
  { key: "spend", label: "Spesa pubblicitaria" },
  { key: "team", label: "Team" },
  { key: "appointments", label: "Appuntamenti" },
] as const;

export type ReportTab = (typeof REPORT_TABS)[number]["key"];

export function parseTab(v: unknown): ReportTab {
  return REPORT_TABS.some(t => t.key === v) ? (v as ReportTab) : "overview";
}

/**
 * Navigazione a tab con semplici link (nessuna callback): i filtri globali
 * restano nell'URL. "Spesa pubblicitaria" e' la pagina /reports/spend.
 */
export function ReportTabs({ slug, active, query }: { slug: string; active: ReportTab; query: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border -mx-1 px-1" aria-label="Sezioni report">
      {REPORT_TABS.map(t => {
        const params = new URLSearchParams(query);
        params.delete("tab");
        if (t.key !== "overview" && t.key !== "spend") params.set("tab", t.key);
        const qs = params.toString();
        const base = companyPath(slug, t.key === "spend" ? "/reports/spend" : "/reports");
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={qs ? `${base}?${qs}` : base}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "px-3 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors",
              isActive ? "border-fg text-fg font-medium" : "border-transparent text-fg-3 hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
