import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import type { MessageChannel, MessageDirection } from "@prisma/client";
import { companyPath } from "@/lib/paths";
import { formatListDate } from "./format";

export type InboxFilter = "all" | "unread" | "email" | "whatsapp";

export const INBOX_FILTERS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "unread", label: "Non letti" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

export type InboxItem = {
  contactId: string;
  name: string;
  unreadCount: number;
  lastMessageAt: string;
  preview: string;
  channel: MessageChannel | null;
  direction: MessageDirection | null;
};

export function inboxHref(slug: string, filter: InboxFilter, contactId?: string | null) {
  const qs = new URLSearchParams();
  if (filter !== "all") qs.set("filter", filter);
  if (contactId) qs.set("contact", contactId);
  const s = qs.toString();
  return companyPath(slug, `/conversations${s ? `?${s}` : ""}`);
}

export default function ConversationList({
  slug,
  items,
  filter,
  selectedId,
  nowIso,
}: {
  slug: string;
  items: InboxItem[];
  filter: InboxFilter;
  selectedId: string | null;
  nowIso: string;
}) {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <nav className="flex gap-1 p-2 overflow-x-auto shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {INBOX_FILTERS.map(f => {
          const on = f.key === filter;
          return (
            <Link
              key={f.key}
              href={inboxHref(slug, f.key, selectedId)}
              className="px-2.5 py-1 rounded-full text-[12px] whitespace-nowrap"
              style={{
                backgroundColor: on ? "var(--fg)" : "var(--subtle)",
                color: on ? "var(--surface)" : "var(--fg-2)",
                fontWeight: on ? 600 : 500,
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
      {items.length === 0 ? (
        <p className="text-[13px] text-center py-10 px-4" style={{ color: "var(--fg-3)" }}>
          {filter === "unread" ? "Nessuna conversazione da leggere." : "Nessuna conversazione."}
        </p>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto">
          {items.map(it => {
            const on = it.contactId === selectedId;
            const Icon = it.channel === "WHATSAPP" ? MessageCircle : Mail;
            return (
              <li key={it.contactId}>
                <Link
                  href={inboxHref(slug, filter, it.contactId)}
                  className="flex gap-3 px-3 py-2.5 transition-colors hover:bg-subtle"
                  style={{
                    backgroundColor: on ? "var(--subtle)" : undefined,
                    borderBottom: "1px solid var(--border)",
                  }}
                  aria-current={on ? "page" : undefined}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold uppercase"
                    style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)", border: "1px solid var(--border)" }}
                    aria-hidden
                  >
                    {it.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] truncate flex-1"
                        style={{ color: "var(--fg)", fontWeight: it.unreadCount > 0 ? 700 : 500 }}
                      >
                        {it.name}
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--fg-3)" }}>
                        {formatListDate(it.lastMessageAt, nowIso)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {it.channel && (
                        <Icon
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: it.channel === "WHATSAPP" ? "var(--ok)" : "var(--info)" }}
                          aria-label={it.channel === "WHATSAPP" ? "WhatsApp" : "Email"}
                        />
                      )}
                      <span
                        className="text-[12px] truncate flex-1"
                        style={{ color: it.unreadCount > 0 ? "var(--fg-2)" : "var(--fg-3)" }}
                      >
                        {it.direction === "OUTBOUND" ? "Tu: " : ""}
                        {it.preview || "—"}
                      </span>
                      {it.unreadCount > 0 && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white shrink-0"
                          style={{ backgroundColor: "#f97316" }}
                        >
                          {it.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
