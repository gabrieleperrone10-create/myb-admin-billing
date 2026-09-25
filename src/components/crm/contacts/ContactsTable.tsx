"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  useLegacyTable,
  legacyCreateColumnHelper,
  getCoreRowModel,
} from "@tanstack/react-table/legacy";
import { flexRender, type RowSelectionState } from "@tanstack/react-table";
import {
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight,
  Tag as TagIcon, UserCog, UserPlus, UserMinus, Repeat, Trash2, X, Mail, Phone,
} from "lucide-react";
import { companyPath } from "@/lib/paths";
import { formatFieldValue } from "@/lib/crm/customFields";
import {
  bulkAddTag, bulkRemoveTag, bulkAssignOwner, bulkAddAssignee, bulkRemoveAssignee, bulkSetLifecycle, bulkDeleteContacts,
} from "@/app/actions/contacts";
import { PAGE_SIZE_OPTIONS, SORT_OPTIONS, type ContactSortKey } from "@/lib/crm/contactQuery";
import { buildHref } from "./url";
import { LIFECYCLE_META, type ContactRow, type MemberOption, type TagOption, type CustomFieldDefLite } from "./types";

function displayName(c: Pick<ContactRow, "firstName" | "lastName" | "email" | "phone" | "companyName">): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.companyName || c.email || c.phone || "Senza nome";
}

const columnHelper = legacyCreateColumnHelper<ContactRow>();

export default function ContactsTable({
  slug,
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  columns: visibleColumns,
  members,
  tags,
  customFieldDefs,
}: {
  slug: string;
  rows: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: ContactSortKey;
  dir: "asc" | "desc";
  columns: string[];
  members: MemberOption[];
  tags: TagOption[];
  customFieldDefs: CustomFieldDefLite[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pending, startTransition] = useTransition();

  const memberName = (id: string | null) => (id ? members.find(m => m.userId === id)?.name ?? null : null);

  const columns = useMemo(() => {
    const cols = [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Seleziona tutti"
            checked={table.getIsAllPageRowsSelected()}
            ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(); }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Seleziona riga"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={e => e.stopPropagation()}
          />
        ),
      }),
      columnHelper.display({
        id: "name",
        header: () => <SortHeader label="Nome" sortKey="name" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{displayName(c)}</p>
              {c.jobTitle && <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>{c.jobTitle}</p>}
            </div>
          );
        },
      }),
    ] as ReturnType<typeof columnHelper.display>[];

    for (const key of visibleColumns) {
      if (key.startsWith("cf:")) {
        const rawKey = key.slice(3);
        const def = customFieldDefs.find(d => d.key === rawKey);
        if (!def) continue;
        cols.push(columnHelper.display({
          id: key,
          header: () => <span>{def.label}</span>,
          cell: ({ row }) => {
            const v = formatFieldValue(def.type, row.original.customFields[def.key] ?? null);
            return <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{v || <Dash />}</span>;
          },
        }));
        continue;
      }

      switch (key) {
        case "lifecycle":
          cols.push(columnHelper.display({
            id: "lifecycle",
            header: () => <SortHeader label="Stato" sortKey="lifecycle" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => {
              const lc = LIFECYCLE_META[row.original.lifecycle];
              return (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: `${lc.color}1a`, color: lc.color }}>
                  {lc.label}
                </span>
              );
            },
          }));
          break;
        case "email":
          cols.push(columnHelper.display({
            id: "email",
            header: () => <SortHeader label="Email" sortKey="email" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => row.original.email
              ? <span className="text-[13px] truncate flex items-center gap-1" style={{ color: "var(--fg-2)" }}><Mail className="w-3 h-3 shrink-0" style={{ color: "var(--fg-3)" }} />{row.original.email}</span>
              : <Dash />,
          }));
          break;
        case "phone":
          cols.push(columnHelper.display({
            id: "phone",
            header: () => <span>Telefono</span>,
            cell: ({ row }) => row.original.phone
              ? <span className="text-[13px] flex items-center gap-1" style={{ color: "var(--fg-2)" }}><Phone className="w-3 h-3 shrink-0" style={{ color: "var(--fg-3)" }} />{row.original.phone}</span>
              : <Dash />,
          }));
          break;
        case "companyName":
          cols.push(columnHelper.display({
            id: "companyName",
            header: () => <SortHeader label="Azienda" sortKey="companyName" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => row.original.companyName ? <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{row.original.companyName}</span> : <Dash />,
          }));
          break;
        case "jobTitle":
          cols.push(columnHelper.display({
            id: "jobTitle",
            header: () => <span>Ruolo</span>,
            cell: ({ row }) => row.original.jobTitle ? <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{row.original.jobTitle}</span> : <Dash />,
          }));
          break;
        case "tags":
          cols.push(columnHelper.display({
            id: "tags",
            header: () => <span>Etichette</span>,
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-1 max-w-[220px]">
                {row.original.tags.length === 0 && <Dash />}
                {row.original.tags.map(t => (
                  <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>{t.name}</span>
                ))}
              </div>
            ),
          }));
          break;
        case "owner":
          cols.push(columnHelper.display({
            id: "owner",
            header: () => <span>Responsabile</span>,
            cell: ({ row }) => {
              const n = memberName(row.original.ownerUserId);
              return n ? <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{n}</span> : <Dash />;
            },
          }));
          break;
        case "assignees":
          cols.push(columnHelper.display({
            id: "assignees",
            header: () => <span>Assegnati</span>,
            cell: ({ row }) => {
              const ids = Array.from(new Set([
                ...(row.original.ownerUserId ? [row.original.ownerUserId] : []),
                ...row.original.assigneeUserIds,
              ]));
              const names = ids.map(memberName).filter((n): n is string => !!n);
              if (names.length === 0) return <Dash />;
              return (
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {names.map(n => (
                    <span key={n} className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>{n}</span>
                  ))}
                </div>
              );
            },
          }));
          break;
        case "source":
          cols.push(columnHelper.display({
            id: "source",
            header: () => <SortHeader label="Fonte" sortKey="source" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => row.original.source ? <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>{row.original.source}</span> : <Dash />,
          }));
          break;
        case "lastActivityAt":
          cols.push(columnHelper.display({
            id: "lastActivityAt",
            header: () => <SortHeader label="Ultima attività" sortKey="lastActivityAt" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => row.original.lastActivityAt
              ? <span className="text-[12px] font-mono" style={{ color: "var(--fg-3)" }}>{new Date(row.original.lastActivityAt).toLocaleDateString("it-IT")}</span>
              : <Dash />,
          }));
          break;
        case "createdAt":
          cols.push(columnHelper.display({
            id: "createdAt",
            header: () => <SortHeader label="Creato il" sortKey="createdAt" sort={sort} dir={dir} pathname={pathname} searchParams={searchParams} />,
            cell: ({ row }) => <span className="text-[12px] font-mono" style={{ color: "var(--fg-3)" }}>{new Date(row.original.createdAt).toLocaleDateString("it-IT")}</span>,
          }));
          break;
      }
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleColumns, sort, dir, pathname, searchParams, customFieldDefs, members]);

  const table = useLegacyTable({
    data: rows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: row => row.id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);

  function goToPage(p: number) {
    router.push(buildHref(pathname, searchParams, { page: p === 1 ? null : String(p) }));
  }

  function afterBulkAction() {
    setRowSelection({});
    router.refresh();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <BulkActionsBar
          slug={slug}
          selectedIds={selectedIds}
          tags={tags}
          members={members}
          pending={pending}
          startTransition={startTransition}
          onDone={afterBulkAction}
          onClear={() => setRowSelection({})}
        />
      )}

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {rows.map(c => (
          <Link key={c.id} href={companyPath(slug, `/contacts/${c.id}`)} className="mobile-card block" style={{ minHeight: "unset" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold truncate" style={{ color: "var(--fg)" }}>{displayName(c)}</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${LIFECYCLE_META[c.lifecycle].color}1a`, color: LIFECYCLE_META[c.lifecycle].color }}>
                {LIFECYCLE_META[c.lifecycle].label}
              </span>
            </div>
            <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--fg-3)" }}>{c.email ?? c.phone ?? c.companyName ?? "—"}</p>
            {c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {c.tags.map(t => (
                  <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}1a`, color: t.color }}>{t.name}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
        {rows.length === 0 && <EmptyRow />}
      </div>

      {/* Desktop: tabella */}
      <div className="hidden md:block rounded-[var(--r-lg)] overflow-x-auto" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} style={{ backgroundColor: "var(--subtle)", borderBottom: "1px solid var(--border)" }}>
                {hg.headers.map(header => (
                  <th key={header.id} className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--fg-3)" }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
                onClick={() => router.push(companyPath(slug, `/contacts/${row.original.id}`))}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--subtle)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-3 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10">
                  <EmptyRow />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginazione */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "var(--fg-3)" }}>
          <span>
            {total} contatt{total === 1 ? "o" : "i"} — pagina {page} di {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => router.push(buildHref(pathname, searchParams, { pageSize: e.target.value, page: null }))}
              className="px-2 py-1 rounded-[var(--r-md)] text-[12px]"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / pagina</option>)}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="p-1.5 rounded-[var(--r-md)] disabled:opacity-40"
              style={{ border: "1px solid var(--border)" }}
              aria-label="Pagina precedente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="p-1.5 rounded-[var(--r-md)] disabled:opacity-40"
              style={{ border: "1px solid var(--border)" }}
              aria-label="Pagina successiva"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Dash() {
  return <span style={{ color: "var(--fg-3)" }}>—</span>;
}

function EmptyRow() {
  return (
    <div className="text-center py-6">
      <p className="text-[13px] font-medium" style={{ color: "var(--fg-2)" }}>Nessun contatto trovato</p>
      <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>Prova a modificare i filtri oppure aggiungi un nuovo contatto.</p>
    </div>
  );
}

function SortHeader({
  label, sortKey, sort, dir, pathname, searchParams,
}: {
  label: string;
  sortKey: ContactSortKey;
  sort: ContactSortKey;
  dir: "asc" | "desc";
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const active = sort === sortKey;
  const nextDir = active && dir === "desc" ? "asc" : "desc";
  const known = SORT_OPTIONS.some(o => o.key === sortKey);
  if (!known) return <span>{label}</span>;
  return (
    <Link
      href={buildHref(pathname, searchParams, { sort: sortKey, dir: nextDir })}
      className="inline-flex items-center gap-1 hover:opacity-80"
      style={{ color: active ? "var(--fg)" : "var(--fg-3)" }}
    >
      {label}
      {active ? (dir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </Link>
  );
}

function BulkActionsBar({
  slug, selectedIds, tags, members, pending, startTransition, onDone, onClear,
}: {
  slug: string;
  selectedIds: string[];
  tags: TagOption[];
  members: MemberOption[];
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDone: () => void;
  onClear: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<"tagAdd" | "tagRemove" | "owner" | "assigneeAdd" | "assigneeRemove" | "lifecycle" | null>(null);

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      setOpenMenu(null);
      onDone();
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-[var(--r-md)] text-[12px]"
      style={{ backgroundColor: "var(--info-soft)", border: "1px solid var(--info)" }}
    >
      <span className="font-medium" style={{ color: "var(--fg)" }}>{selectedIds.length} selezionati</span>

      <BulkMenu label="Aggiungi etichetta" icon={TagIcon} open={openMenu === "tagAdd"} onToggle={() => setOpenMenu(m => m === "tagAdd" ? null : "tagAdd")}>
        {tags.map(t => (
          <button key={t.id} type="button" disabled={pending} onClick={() => run(() => bulkAddTag(slug, selectedIds, t.id))} className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            {t.name}
          </button>
        ))}
        {tags.length === 0 && <p className="px-2.5 py-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessuna etichetta</p>}
      </BulkMenu>

      <BulkMenu label="Rimuovi etichetta" icon={X} open={openMenu === "tagRemove"} onToggle={() => setOpenMenu(m => m === "tagRemove" ? null : "tagRemove")}>
        {tags.map(t => (
          <button key={t.id} type="button" disabled={pending} onClick={() => run(() => bulkRemoveTag(slug, selectedIds, t.id))} className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            {t.name}
          </button>
        ))}
        {tags.length === 0 && <p className="px-2.5 py-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessuna etichetta</p>}
      </BulkMenu>

      <BulkMenu label="Assegna responsabile" icon={UserCog} open={openMenu === "owner"} onToggle={() => setOpenMenu(m => m === "owner" ? null : "owner")}>
        <button type="button" disabled={pending} onClick={() => run(() => bulkAssignOwner(slug, selectedIds, null))} className="w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]" style={{ color: "var(--fg-3)" }}>Nessuno</button>
        {members.map(m => (
          <button key={m.userId} type="button" disabled={pending} onClick={() => run(() => bulkAssignOwner(slug, selectedIds, m.userId))} className="w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">{m.name}</button>
        ))}
      </BulkMenu>

      <BulkMenu label="Assegna a…" icon={UserPlus} open={openMenu === "assigneeAdd"} onToggle={() => setOpenMenu(m => m === "assigneeAdd" ? null : "assigneeAdd")}>
        {members.map(m => (
          <button key={m.userId} type="button" disabled={pending} onClick={() => run(() => bulkAddAssignee(slug, selectedIds, m.userId))} className="w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">{m.name}</button>
        ))}
        {members.length === 0 && <p className="px-2.5 py-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun membro</p>}
      </BulkMenu>

      <BulkMenu label="Rimuovi assegnazione…" icon={UserMinus} open={openMenu === "assigneeRemove"} onToggle={() => setOpenMenu(m => m === "assigneeRemove" ? null : "assigneeRemove")}>
        {members.map(m => (
          <button key={m.userId} type="button" disabled={pending} onClick={() => run(() => bulkRemoveAssignee(slug, selectedIds, m.userId))} className="w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">{m.name}</button>
        ))}
        {members.length === 0 && <p className="px-2.5 py-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun membro</p>}
      </BulkMenu>

      <BulkMenu label="Cambia stato" icon={Repeat} open={openMenu === "lifecycle"} onToggle={() => setOpenMenu(m => m === "lifecycle" ? null : "lifecycle")}>
        {(["LEAD", "CUSTOMER", "ARCHIVED"] as const).map(lc => (
          <button key={lc} type="button" disabled={pending} onClick={() => run(() => bulkSetLifecycle(slug, selectedIds, lc))} className="w-full px-2.5 py-1.5 text-left hover:bg-black/5 rounded-[6px]">{LIFECYCLE_META[lc].label}</button>
        ))}
      </BulkMenu>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Eliminare definitivamente ${selectedIds.length} contatti? L'operazione non è reversibile.`)) return;
          run(() => bulkDeleteContacts(slug, selectedIds));
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px]"
        style={{ color: "var(--danger)" }}
      >
        <Trash2 className="w-3.5 h-3.5" /> Elimina
      </button>

      <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 px-2 py-1" style={{ color: "var(--fg-3)" }}>
        <X className="w-3.5 h-3.5" /> Deseleziona
      </button>
    </div>
  );
}

function BulkMenu({
  label, icon: Icon, open, onToggle, children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px]"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div
            className="absolute left-0 mt-1 min-w-[180px] max-h-[260px] overflow-y-auto rounded-[var(--r-md)] py-1 z-20"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
