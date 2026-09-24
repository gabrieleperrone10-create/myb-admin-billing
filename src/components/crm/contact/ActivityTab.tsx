import Link from "next/link";
import { formatDistanceToNowStrict, isToday, isYesterday, format } from "date-fns";
import { it } from "date-fns/locale";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { listCompanyMembers, memberName } from "@/lib/crm/members";
import { getUserPermissions, canEdit } from "@/lib/permissions";
import { NoteComposer } from "./notes/NoteComposer";
import { NoteCard } from "./notes/NoteCard";
import { ActivityFilters } from "./timeline/ActivityFilters";
import { ActivityItem } from "./timeline/ActivityItem";
import { activityTypesForFilter } from "./timeline/filters";
import { STANDARD_FIELD_LABEL } from "./timeline/describeActivity";
import type { ContactTabProps } from "./types";

const PAGE_SIZE = 20;

function relativeTime(d: Date): string {
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: it });
}

function dayLabel(d: Date): string {
  if (isToday(d)) return "Oggi";
  if (isYesterday(d)) return "Ieri";
  const label = format(d, "EEEE d MMMM", { locale: it });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Tab Attivita': composer nota, note appuntate, filtri a chip, cronologia
 * raggruppata per giorno con paginazione "carica altri" via searchParam.
 *
 * Proprietario: agente B.
 */
export default async function ActivityTab({ slug, contactId, searchParams }: ContactTabProps) {
  const sp = searchParams ?? {};
  const filterKey = typeof sp.type === "string" ? sp.type : "ALL";
  const limit = Math.min(Math.max(Number(sp.activityLimit) || PAGE_SIZE, PAGE_SIZE), 500);
  const types = activityTypesForFilter(filterKey);

  const { db, companyId, userId } = await requireCompany(slug);

  const [pinnedNotes, rows, members, defs, perms] = await Promise.all([
    db.note.findMany({ where: { contactId, pinned: true }, orderBy: { updatedAt: "desc" } }),
    db.activity.findMany({
      where: { contactId, ...(types ? { type: { in: types } } : {}) },
      orderBy: { occurredAt: "desc" },
      take: limit + 1,
    }),
    listCompanyMembers(companyId),
    db.customFieldDef.findMany({ where: { entity: "CONTACT" } }),
    getUserPermissions(db, companyId, userId),
  ]);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const canEditContacts = canEdit(perms, "CONTACTS");

  const fieldLabels: Record<string, string> = { ...STANDARD_FIELD_LABEL };
  for (const def of defs) fieldLabels[`cf:${def.key}`] = def.label;

  const noteIds = page.filter(a => a.type === "NOTE_ADDED").map(a => (a.data as { noteId?: string }).noteId).filter((x): x is string => !!x);
  const notesById = new Map(
    noteIds.length
      ? (await db.note.findMany({ where: { id: { in: noteIds } } })).map(n => [n.id, n])
      : [],
  );

  const groups: { label: string; items: typeof page }[] = [];
  for (const a of page) {
    const label = dayLabel(a.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  const loadMoreHref = companyPath(
    slug,
    `/contacts/${contactId}?tab=activity&type=${filterKey}&activityLimit=${limit + PAGE_SIZE}`,
  );

  return (
    <div className="max-w-3xl space-y-5">
      <NoteComposer slug={slug} contactId={contactId} />

      {pinnedNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>Note appuntate</h3>
          {pinnedNotes.map(note => (
            <NoteCard
              key={note.id}
              slug={slug}
              contactId={contactId}
              note={note}
              authorName={memberName(members, note.authorUserId) ?? "Sistema"}
              timeLabel={relativeTime(note.createdAt)}
              canEdit={canEditContacts || note.authorUserId === userId}
            />
          ))}
        </div>
      )}

      <ActivityFilters slug={slug} contactId={contactId} active={filterKey} />

      <div className="space-y-5">
        {groups.length === 0 && (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>Nessuna attività da mostrare</p>
        )}
        {groups.map(group => (
          <div key={group.label}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--fg-3)" }}>{group.label}</h3>
            <div className="rounded-[var(--r-lg)] divide-y divide-border" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
              {group.items.map(a => {
                if (a.type === "NOTE_ADDED") {
                  const noteId = (a.data as { noteId?: string }).noteId;
                  const note = noteId ? notesById.get(noteId) : undefined;
                  if (!note) return null;
                  return (
                    <div key={a.id} className="p-2">
                      <NoteCard
                        slug={slug}
                        contactId={contactId}
                        note={note}
                        authorName={memberName(members, note.authorUserId) ?? "Sistema"}
                        timeLabel={relativeTime(a.occurredAt)}
                        canEdit={canEditContacts || note.authorUserId === userId}
                      />
                    </div>
                  );
                }
                return (
                  <div key={a.id} className="px-3">
                    <ActivityItem
                      activity={a}
                      fieldLabels={fieldLabels}
                      authorName={memberName(members, a.actorUserId)}
                      timeLabel={relativeTime(a.occurredAt)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center">
          <Link
            href={loadMoreHref}
            className="inline-flex text-[12px] font-medium px-3 py-1.5 rounded-[var(--r-md)]"
            style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}
          >
            Carica altri
          </Link>
        </div>
      )}
    </div>
  );
}
