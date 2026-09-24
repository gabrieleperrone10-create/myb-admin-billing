import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, MessagesSquare } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { canView, getEffectivePermissions } from "@/lib/permissions";
import { contactDisplayName } from "@/lib/crm/contacts";
import { htmlToText } from "@/lib/crm/messaging/signatures";
import ConversationList, { inboxHref, type InboxFilter, type InboxItem } from "@/components/crm/conversations/ConversationList";
import ConversationView from "@/components/crm/conversations/ConversationView";
import AutoRefresh from "@/components/crm/conversations/AutoRefresh";

export const dynamic = "force-dynamic";

const FILTERS: InboxFilter[] = ["all", "unread", "email", "whatsapp"];

/**
 * Casella unica: contatti con messaggi ordinati per ultimo messaggio.
 * Desktop: lista a sinistra, thread a destra (?contact=id). Mobile: lista
 * oppure thread (con freccia indietro), mai entrambi.
 */
export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ filter?: string; contact?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireCompany(slug);
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);

  if (!canView(perms, "CONVERSATIONS")) {
    return (
      <p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>
        Non hai i permessi per vedere le conversazioni.
      </p>
    );
  }

  const filter: InboxFilter = FILTERS.includes(sp.filter as InboxFilter) ? (sp.filter as InboxFilter) : "all";
  const where: Prisma.ContactWhereInput = { lastMessageAt: { not: null } };
  if (filter === "unread") where.unreadCount = { gt: 0 };
  if (filter === "email") where.messages = { some: { channel: "EMAIL" } };
  if (filter === "whatsapp") where.messages = { some: { channel: "WHATSAPP" } };

  const contacts = await ctx.db.contact.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true,
      unreadCount: true, lastMessageAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { channel: true, direction: true, subject: true, bodyText: true, bodyHtml: true },
      },
    },
  });

  const items: InboxItem[] = contacts.map(c => {
    const m = c.messages[0];
    const text = m ? (m.bodyText ?? (m.bodyHtml ? htmlToText(m.bodyHtml) : "")) : "";
    const preview = [m?.channel === "EMAIL" ? m.subject : null, text].filter(Boolean).join(" — ").replace(/\s+/g, " ").slice(0, 140);
    return {
      contactId: c.id,
      name: contactDisplayName(c),
      unreadCount: c.unreadCount,
      lastMessageAt: (c.lastMessageAt ?? new Date()).toISOString(),
      preview,
      channel: m?.channel ?? null,
      direction: m?.direction ?? null,
    };
  });

  // Il contatto selezionato puo' essere fuori dalla lista (filtro): lo si
  // verifica comunque con ctx.db, filtrato per azienda.
  const selected = sp.contact
    ? await ctx.db.contact.findUnique({
        where: { id: sp.contact },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true },
      })
    : null;
  const nowIso = new Date().toISOString();

  return (
    <div className="max-w-6xl">
      {!selected && <AutoRefresh />}
      <div className={`mb-4 ${selected ? "hidden md:block" : ""}`}>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Conversazioni</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">Email e WhatsApp con i tuoi contatti, in un&apos;unica casella</p>
      </div>

      <div
        className="md:grid md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] md:gap-4 md:h-[calc(100dvh-var(--topbar-h)-150px)] md:min-h-[480px]"
      >
        <section
          className={`${selected ? "hidden md:flex" : "flex"} flex-col min-h-0 rounded-[var(--r-lg)] overflow-hidden`}
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
          aria-label="Elenco conversazioni"
        >
          <ConversationList slug={slug} items={items} filter={filter} selectedId={selected?.id ?? null} nowIso={nowIso} />
        </section>

        <section className={`${selected ? "flex" : "hidden md:flex"} flex-col min-h-0`} aria-label="Conversazione">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-2 shrink-0">
                <Link
                  href={inboxHref(slug, filter)}
                  className="md:hidden p-1 -ml-1"
                  style={{ color: "var(--fg-3)" }}
                  aria-label="Torna all'elenco"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h2 className="text-[15px] font-semibold truncate flex-1" style={{ color: "var(--fg)" }}>
                  {contactDisplayName(selected)}
                </h2>
                <Link
                  href={companyPath(slug, `/contacts/${selected.id}`)}
                  className="inline-flex items-center gap-1 text-[12px] hover:underline shrink-0"
                  style={{ color: "var(--fg-2)" }}
                >
                  Scheda contatto <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex-1 min-h-0 h-[calc(100dvh-var(--topbar-h)-var(--nav-h)-120px)] md:h-auto">
                <Suspense
                  key={selected.id}
                  fallback={<p className="text-[13px] py-10 text-center" style={{ color: "var(--fg-3)" }}>Caricamento…</p>}
                >
                  <ConversationView slug={slug} contactId={selected.id} variant="inbox" />
                </Suspense>
              </div>
            </>
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)]"
              style={{ border: "1px dashed var(--border)", color: "var(--fg-3)" }}
            >
              <MessagesSquare className="w-8 h-8" />
              <p className="text-[13px]">Seleziona una conversazione</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
