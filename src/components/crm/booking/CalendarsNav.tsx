import Link from "next/link";

/** Tab "Calendari | Agenda" in cima alle pagine del modulo. */
export function CalendarsNav({ slug, active }: { slug: string; active: "calendars" | "agenda" }) {
  const tabs = [
    { key: "calendars", label: "Calendari", href: `/${slug}/calendars` },
    { key: "agenda", label: "Agenda", href: `/${slug}/calendars/appointments` },
  ] as const;
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map(t => (
        <Link
          key={t.key}
          href={t.href}
          className="px-3 py-2 text-[13px] font-medium -mb-px border-b-2 transition-colors"
          style={{
            borderColor: t.key === active ? "var(--fg)" : "transparent",
            color: t.key === active ? "var(--fg)" : "var(--fg-3)",
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
