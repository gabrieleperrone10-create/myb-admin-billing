export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { requireCompany } from "@/lib/company";
import { listCompanyMembers } from "@/lib/crm/members";
import {
  parseContactSearchParams, contactWhere, contactOrderBy, CONTACT_TABS,
  type ContactTab,
} from "@/lib/crm/contactQuery";
import type { CustomFieldValues } from "@/lib/crm/customFields";
import ContactsToolbar from "@/components/crm/contacts/ContactsToolbar";
import ContactsTable from "@/components/crm/contacts/ContactsTable";
import type { ContactRow, CustomFieldDefLite, SavedViewLite } from "@/components/crm/contacts/types";

/**
 * Lista Lead + Clienti. Filtri, ordinamento e paginazione sono lato server,
 * pilotati dai searchParams (vedi src/lib/crm/contactQuery.ts): l'URL e' lo
 * stato, quindi ogni vista e' condivisibile con un link.
 */
export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireCompany(slug);
  const { db, companyId, userId } = ctx;

  const query = parseContactSearchParams(sp);

  const [customFieldDefsRaw, crmTagsRaw, members, savedViewsRaw, sourceRows] = await Promise.all([
    db.customFieldDef.findMany({ where: { entity: "CONTACT" }, orderBy: { order: "asc" } }),
    db.crmTag.findMany({ orderBy: { name: "asc" } }),
    listCompanyMembers(companyId),
    db.savedView.findMany({
      where: { entity: "CONTACT", OR: [{ clerkUserId: userId }, { isShared: true }] },
      orderBy: { name: "asc" },
    }),
    db.contact.findMany({ where: { source: { not: null } }, distinct: ["source"], select: { source: true }, take: 50 }),
  ]);

  const customFieldDefs: CustomFieldDefLite[] = customFieldDefsRaw.map(d => ({
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: Array.isArray(d.options) ? (d.options as unknown[]).map(String) : [],
    required: d.required,
    order: d.order,
  }));

  const tags = crmTagsRaw.map(t => ({ id: t.id, name: t.name, color: t.color }));
  const sourceOptions = sourceRows.map(r => r.source).filter((s): s is string => !!s).sort();

  const savedViews: SavedViewLite[] = savedViewsRaw.map(v => ({
    id: v.id,
    name: v.name,
    isShared: v.isShared,
    mine: v.clerkUserId === userId,
    filters: (v.filters ?? {}) as Record<string, unknown>,
    columns: Array.isArray(v.columns) ? (v.columns as unknown[]).map(String) : [],
    sort: v.sort as { key: string; dir: "asc" | "desc" } | null,
  }));

  const orderBy = contactOrderBy(query.sort, query.dir);

  const tabEntries = await Promise.all(
    CONTACT_TABS.map(async t => [t.key, await db.contact.count({ where: contactWhere(query.filters, t.key, customFieldDefsRaw) })] as const),
  );
  const tabCounts = Object.fromEntries(tabEntries) as Record<ContactTab, number>;

  const where = contactWhere(query.filters, query.tab, customFieldDefsRaw);
  const total = tabCounts[query.tab];

  const contactsRaw = await db.contact.findMany({
    where,
    orderBy,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    include: { tags: { include: { tag: true } }, assignees: true },
  });

  const rows: ContactRow[] = contactsRaw.map(c => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    companyName: c.companyName,
    jobTitle: c.jobTitle,
    lifecycle: c.lifecycle,
    source: c.source,
    ownerUserId: c.ownerUserId,
    assigneeUserIds: c.assignees.map(a => a.userId),
    lastActivityAt: c.lastActivityAt,
    createdAt: c.createdAt,
    customFields: (c.customFields ?? {}) as CustomFieldValues,
    tags: c.tags.map(ct => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
  }));

  const memberOptions = members.map(m => ({ userId: m.userId, name: m.name }));

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* useSearchParams() nei componenti client sotto richiede un boundary Suspense
          (vedi clients/page.tsx): i dati sono gia' risolti qui sopra, quindi il
          fallback in pratica non si vede mai, serve solo a soddisfare Next. */}
      <Suspense fallback={null}>
        <ContactsToolbar
          slug={slug}
          tab={query.tab}
          tabCounts={tabCounts}
          filters={query.filters}
          columns={query.columns}
          sort={query.sort}
          dir={query.dir}
          tags={tags}
          members={memberOptions}
          customFieldDefs={customFieldDefs}
          savedViews={savedViews}
          sourceOptions={sourceOptions}
          currentUserId={userId}
        />
        <ContactsTable
          slug={slug}
          rows={rows}
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          sort={query.sort}
          dir={query.dir}
          columns={query.columns}
          members={memberOptions}
          tags={tags}
          customFieldDefs={customFieldDefs}
        />
      </Suspense>
    </div>
  );
}
