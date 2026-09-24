import Link from "next/link";
import { companyPath } from "@/lib/paths";
import { ACTIVITY_FILTERS } from "./filters";

/** Chip di filtro della cronologia: link semplici (?tab=activity&type=...), niente JS. */
export function ActivityFilters({ slug, contactId, active }: { slug: string; contactId: string; active: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIVITY_FILTERS.map(f => {
        const on = f.key === active;
        return (
          <Link
            key={f.key}
            href={companyPath(slug, `/contacts/${contactId}?tab=activity&type=${f.key}`)}
            className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: on ? "var(--fg)" : "var(--subtle)",
              color: on ? "#fff" : "var(--fg-2)",
            }}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
