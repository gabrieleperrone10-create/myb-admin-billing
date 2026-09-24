import type { Prisma, CustomFieldDef } from "@prisma/client";
import type { ContactFilters } from "@/lib/crm/types";

/**
 * Costruzione del `where`/`orderBy` Prisma per la lista contatti a partire
 * dai searchParams dell'URL. Unico punto che traduce filtri lato client in
 * query lato server: la pagina e le viste salvate condividono questa forma.
 *
 * `ctx.db` (src/lib/db.ts) filtra gia' per azienda su findMany/count, quindi
 * qui non serve mai passare companyId a mano.
 *
 * Niente `import "server-only"` qui: il file e' puro (nessun accesso a
 * db/rete, i riferimenti a Prisma sono solo tipi cancellati a compile-time),
 * quindi i componenti client possono importare le costanti (tab, colonne,
 * opzioni di ordinamento) senza tirarsi dietro codice server.
 */

export type ContactTab = "all" | "lead" | "customer" | "archived";

export const CONTACT_TABS: { key: ContactTab; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "lead", label: "Lead" },
  { key: "customer", label: "Clienti" },
  { key: "archived", label: "Archiviati" },
];

export type ContactSortKey =
  | "name" | "email" | "companyName" | "lifecycle" | "source" | "createdAt" | "lastActivityAt";

export const SORT_OPTIONS: { key: ContactSortKey; label: string }[] = [
  { key: "lastActivityAt", label: "Ultima attività" },
  { key: "createdAt", label: "Data creazione" },
  { key: "name", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "companyName", label: "Azienda" },
  { key: "lifecycle", label: "Stato" },
  { key: "source", label: "Fonte" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** Colonne disponibili nella tabella (oltre a quelle standard, una per ogni CustomFieldDef via "cf:<key>"). */
export const STANDARD_COLUMNS = [
  "lifecycle", "email", "phone", "companyName", "jobTitle", "tags", "owner", "source", "lastActivityAt", "createdAt",
] as const;
export type StandardColumn = (typeof STANDARD_COLUMNS)[number];

export const DEFAULT_COLUMNS: string[] = ["lifecycle", "email", "phone", "tags", "owner", "lastActivityAt"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function csv(v: string | string[] | undefined): string[] {
  const s = first(v);
  return s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];
}

export type ParsedContactQuery = {
  filters: ContactFilters;
  tab: ContactTab;
  page: number;
  pageSize: number;
  sort: ContactSortKey;
  dir: "asc" | "desc";
  columns: string[];
  view?: string;
};

/**
 * Legge i searchParams della pagina /contacts. I filtri sui campi
 * personalizzati arrivano come `cf_<key>=valore` (uno per campo attivo).
 */
export function parseContactSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ParsedContactQuery {
  const tab = (first(sp.tab) as ContactTab) ?? "all";
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const pageSizeRaw = Number(first(sp.pageSize)) || DEFAULT_PAGE_SIZE;
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const sort = (SORT_OPTIONS.some(o => o.key === first(sp.sort)) ? first(sp.sort) : "lastActivityAt") as ContactSortKey;
  const dir = first(sp.dir) === "asc" ? "asc" : "desc";
  const columns = sp.cols !== undefined ? csv(sp.cols) : DEFAULT_COLUMNS;

  const custom: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (key.startsWith("cf_")) {
      const v = first(value);
      if (v) custom[key.slice(3)] = v;
    }
  }

  const filters: ContactFilters = {
    q: first(sp.q) || undefined,
    tagIds: csv(sp.tags),
    ownerUserIds: csv(sp.owners),
    source: csv(sp.source),
    createdFrom: first(sp.createdFrom) || undefined,
    createdTo: first(sp.createdTo) || undefined,
    custom: Object.keys(custom).length ? custom : undefined,
  };

  return { filters, tab: ["all", "lead", "customer", "archived"].includes(tab) ? tab : "all", page, pageSize, sort, dir, columns, view: first(sp.view) };
}

/** Where comune a tutti i tab (usato anche per i conteggi). */
function baseWhere(filters: ContactFilters, customFieldDefs: Pick<CustomFieldDef, "key" | "type">[]): Prisma.ContactWhereInput {
  const AND: Prisma.ContactWhereInput[] = [];

  if (filters.q) {
    const q = filters.q;
    AND.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { whatsapp: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.tagIds?.length) {
    AND.push({ tags: { some: { tagId: { in: filters.tagIds } } } });
  }

  if (filters.ownerUserIds?.length) {
    AND.push({ ownerUserId: { in: filters.ownerUserIds } });
  }

  if (filters.source?.length) {
    AND.push({ source: { in: filters.source } });
  }

  if (filters.createdFrom || filters.createdTo) {
    AND.push({
      createdAt: {
        ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
        ...(filters.createdTo ? { lte: endOfDay(filters.createdTo) } : {}),
      },
    });
  }

  if (filters.custom) {
    for (const [key, raw] of Object.entries(filters.custom)) {
      const def = customFieldDefs.find(d => d.key === key);
      if (def?.type === "MULTISELECT") {
        // Il valore JSON e' un array di stringhe: verifica che lo contenga.
        AND.push({ customFields: { path: [key], array_contains: [raw] } });
      } else {
        AND.push({ customFields: { path: [key], equals: coerceForEquals(raw) } });
      }
    }
  }

  return AND.length ? { AND } : {};
}

function coerceForEquals(raw: string | number | boolean): Prisma.InputJsonValue {
  return raw as Prisma.InputJsonValue;
}

function endOfDay(isoDate: string): Date {
  const d = new Date(isoDate);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Where per un tab specifico (aggiunge il filtro lifecycle). */
export function contactWhere(
  filters: ContactFilters,
  tab: ContactTab,
  customFieldDefs: Pick<CustomFieldDef, "key" | "type">[] = [],
): Prisma.ContactWhereInput {
  const base = baseWhere(filters, customFieldDefs);
  if (tab === "all") return base;
  const lifecycle = tab === "lead" ? "LEAD" : tab === "customer" ? "CUSTOMER" : "ARCHIVED";
  return { AND: [base, { lifecycle }] };
}

export function contactOrderBy(sort: ContactSortKey, dir: "asc" | "desc"): Prisma.ContactOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ firstName: dir }, { lastName: dir }];
    case "email":
      return [{ email: dir }];
    case "companyName":
      return [{ companyName: dir }];
    case "lifecycle":
      return [{ lifecycle: dir }];
    case "source":
      return [{ source: dir }];
    case "createdAt":
      return [{ createdAt: dir }];
    case "lastActivityAt":
    default:
      return [{ lastActivityAt: { sort: dir, nulls: "last" } }];
  }
}

/** Serializza lo stato corrente (filtri+colonne+ordinamento) come record per costruire l'URL, usato da SearchParams e dalle viste salvate. */
export function queryToSearchParams(q: Omit<ParsedContactQuery, "view">): URLSearchParams {
  const params = new URLSearchParams();
  if (q.tab !== "all") params.set("tab", q.tab);
  if (q.filters.q) params.set("q", q.filters.q);
  if (q.filters.tagIds?.length) params.set("tags", q.filters.tagIds.join(","));
  if (q.filters.ownerUserIds?.length) params.set("owners", q.filters.ownerUserIds.join(","));
  if (q.filters.source?.length) params.set("source", q.filters.source.join(","));
  if (q.filters.createdFrom) params.set("createdFrom", q.filters.createdFrom);
  if (q.filters.createdTo) params.set("createdTo", q.filters.createdTo);
  if (q.filters.custom) {
    for (const [k, v] of Object.entries(q.filters.custom)) params.set(`cf_${k}`, String(v));
  }
  if (q.page !== 1) params.set("page", String(q.page));
  if (q.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(q.pageSize));
  if (q.sort !== "lastActivityAt") params.set("sort", q.sort);
  if (q.dir !== "desc") params.set("dir", q.dir);
  params.set("cols", q.columns.join(","));
  return params;
}
