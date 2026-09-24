"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown, ChevronRight, CalendarClock, KanbanSquare } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { OpportunityDrawer } from "@/components/crm/opportunities/OpportunityDrawer";
import type { CustomFieldDefData, MemberData, OpportunityCardData, PipelineData, ProductData } from "@/components/crm/opportunities/types";
import type { PickedContact } from "@/components/crm/opportunities/ContactPicker";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Aperta", color: "var(--info)" },
  WON: { label: "Vinta", color: "var(--ok)" },
  LOST: { label: "Persa", color: "var(--danger)" },
};

type OppWithExtra = OpportunityCardData & {
  stageName: string; stageColor: string; pipelineName: string;
  stageChanges: { id: string; changedAt: string; fromStage: string | null; toStage: string }[];
};

export function OpportunitiesTabClient({
  slug, contact, opportunities, pipelines, members, products, customFieldDefs,
}: {
  slug: string;
  contact: PickedContact;
  opportunities: OppWithExtra[];
  pipelines: PipelineData[];
  members: MemberData[];
  products: ProductData[];
  customFieldDefs: CustomFieldDefData[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OppWithExtra | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuova opportunità
        </button>
      </div>

      {opportunities.length === 0 ? (
        <EmptyState icon={KanbanSquare} title="Nessuna opportunità" subtitle="Crea la prima opportunità per questo contatto" />
      ) : (
        <div className="space-y-2">
          {opportunities.map(opp => {
            const status = STATUS_LABEL[opp.status];
            const isOpen = expanded.has(opp.id);
            return (
              <div key={opp.id} className="rounded-[var(--r-lg)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
                <div
                  className="flex items-center gap-3 px-3.5 py-3 cursor-pointer"
                  onClick={() => { setEditing(opp); setDrawerOpen(true); }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: opp.stageColor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{opp.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>{opp.pipelineName} · {opp.stageName}</p>
                  </div>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--fg)" }}>{formatCurrency(opp.value)}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}18`, color: status.color }}>
                    {status.label}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); toggle(opp.id); }}
                    style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {opp.expectedCloseDate && (
                  <div className="px-3.5 pb-2 flex items-center gap-1 text-[11px]" style={{ color: "var(--fg-3)" }}>
                    <CalendarClock className="w-3 h-3" /> Chiusura prevista {formatDate(opp.expectedCloseDate)}
                  </div>
                )}

                {isOpen && (
                  <div className="px-3.5 pb-3 pt-1 space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="font-mono text-[10px] uppercase tracking-table-head pt-2" style={{ color: "var(--fg-3)" }}>Storico fasi</p>
                    {opp.stageChanges.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun cambio registrato</p>
                    ) : (
                      opp.stageChanges.map(c => (
                        <p key={c.id} className="text-[12px]" style={{ color: "var(--fg-2)" }}>
                          {c.fromStage ? `${c.fromStage} → ${c.toStage}` : `Creata in ${c.toStage}`}
                          <span style={{ color: "var(--fg-3)" }}> · {formatDate(c.changedAt)}</span>
                        </p>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link href={`/${slug}/opportunities`} className="inline-block text-[12px]" style={{ color: "var(--info)" }}>
        Apri il kanban delle opportunità →
      </Link>

      <OpportunityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pipelines={pipelines}
        members={members}
        products={products}
        customFieldDefs={customFieldDefs}
        opportunity={editing}
        defaultContact={contact}
        defaultPipelineId={pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id}
      />
    </div>
  );
}
