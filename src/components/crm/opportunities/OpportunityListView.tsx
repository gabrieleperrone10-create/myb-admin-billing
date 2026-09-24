"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, CalendarClock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { OwnerAvatar } from "./OpportunityCard";
import { OpportunityDrawer } from "./OpportunityDrawer";
import type { CustomFieldDefData, MemberData, OpportunityCardData, PipelineData, ProductData, StageData } from "./types";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Aperta", color: "var(--info)" },
  WON: { label: "Vinta", color: "var(--ok)" },
  LOST: { label: "Persa", color: "var(--danger)" },
};

const SORTS = [
  { key: "name", label: "Nome" },
  { key: "value", label: "Valore" },
  { key: "stage", label: "Fase" },
  { key: "closeDate", label: "Chiusura prevista" },
  { key: "updated", label: "Aggiornata" },
];

export function OpportunityListView({
  pipelines, currentPipelineId, stages, opportunities, members, products, customFieldDefs,
}: {
  pipelines: PipelineData[];
  currentPipelineId: string;
  stages: StageData[];
  opportunities: OpportunityCardData[];
  members: MemberData[];
  products: ProductData[];
  customFieldDefs: CustomFieldDefData[];
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const sort = sp.get("sort") ?? "updated";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";

  const [editing, setEditing] = useState<OpportunityCardData | null>(null);

  function sortHref(key: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("sort", key);
    params.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `${pathname}?${params.toString()}`;
  }

  const stageById = new Map(stages.map(s => [s.id, s]));

  return (
    <div>
      <div className="hidden md:block bg-surface border border-border rounded-[var(--r-lg)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              {SORTS.map(s => (
                <th key={s.key} className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">
                  <Link href={sortHref(s.key)} className="inline-flex items-center gap-1 hover:text-fg-2">
                    {s.label}
                    {sort === s.key && (dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </Link>
                </th>
              ))}
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Responsabile</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Stato</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map(opp => {
              const stage = stageById.get(opp.stageId);
              const status = STATUS_LABEL[opp.status];
              const overdue = opp.status === "OPEN" && !!opp.expectedCloseDate && new Date(opp.expectedCloseDate) < new Date(new Date().toDateString());
              return (
                <tr key={opp.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors cursor-pointer" onClick={() => setEditing(opp)}>
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] font-medium text-fg">{opp.name}</p>
                    <p className="text-[11px] text-fg-3">{opp.contact.name}{opp.contact.companyName ? ` · ${opp.contact.companyName}` : ""}</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-fg-2 tabular-nums">{formatCurrency(opp.value)}</td>
                  <td className="px-4 py-2.5">
                    {stage && (
                      <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--fg-2)" }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]" style={{ color: overdue ? "var(--danger)" : "var(--fg-2)" }}>
                    {opp.expectedCloseDate ? (
                      <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{formatDate(opp.expectedCloseDate)}</span>
                    ) : <span className="text-fg-3">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-fg-2">{formatDate(opp.stageEnteredAt)}</td>
                  <td className="px-4 py-2.5"><OwnerAvatar userId={opp.ownerUserId} members={members} /></td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}18`, color: status.color }}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {opportunities.length === 0 && (
          <p className="text-center text-[13px] py-10" style={{ color: "var(--fg-3)" }}>Nessuna opportunità trovata</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {opportunities.map(opp => {
          const stage = stageById.get(opp.stageId);
          const status = STATUS_LABEL[opp.status];
          return (
            <div key={opp.id} className="mobile-card" onClick={() => setEditing(opp)} role="button" tabIndex={0}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[14px] font-semibold text-fg truncate">{opp.name}</p>
                <OwnerAvatar userId={opp.ownerUserId} members={members} size={20} />
              </div>
              <p className="text-[12px] text-fg-3 mb-1.5">{opp.contact.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold tabular-nums text-fg">{formatCurrency(opp.value)}</span>
                <div className="flex items-center gap-1.5">
                  {stage && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>{stage.name}</span>
                  )}
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}18`, color: status.color }}>{status.label}</span>
                </div>
              </div>
            </div>
          );
        })}
        {opportunities.length === 0 && (
          <p className="text-center text-[13px] py-10" style={{ color: "var(--fg-3)" }}>Nessuna opportunità trovata</p>
        )}
      </div>

      {editing && (
        <OpportunityDrawer
          open
          onClose={() => setEditing(null)}
          pipelines={pipelines}
          members={members}
          products={products}
          customFieldDefs={customFieldDefs}
          opportunity={editing}
          defaultPipelineId={currentPipelineId}
        />
      )}
    </div>
  );
}
