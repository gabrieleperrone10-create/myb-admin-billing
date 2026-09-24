"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useCompanySlug } from "@/lib/useCompany";
import { formatCurrency } from "@/lib/utils";
import { moveOpportunityAction } from "@/app/actions/opportunities";
import { OpportunityCard } from "./OpportunityCard";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { WonDialog } from "./WonDialog";
import { LostReasonDialog } from "./LostReasonDialog";
import { FollowUpPrompt } from "@/components/crm/tasks/FollowUpPrompt";
import type { NextTaskSummary } from "@/components/crm/tasks/types";
import type { CustomFieldDefData, MemberData, OpportunityCardData, PipelineData, ProductData, StageData } from "./types";

function groupByStage(stages: StageData[], opportunities: OpportunityCardData[]): Record<string, OpportunityCardData[]> {
  const out: Record<string, OpportunityCardData[]> = {};
  for (const s of stages) out[s.id] = [];
  for (const opp of opportunities) {
    if (!out[opp.stageId]) out[opp.stageId] = [];
    out[opp.stageId].push(opp);
  }
  for (const id of Object.keys(out)) out[id].sort((a, b) => a.position - b.position);
  return out;
}

export function KanbanBoard({
  pipelines, currentPipelineId, stages, opportunities, members, products, customFieldDefs, nextTaskByOpportunity = {},
}: {
  pipelines: PipelineData[];
  currentPipelineId: string;
  stages: StageData[];
  opportunities: OpportunityCardData[];
  members: MemberData[];
  products: ProductData[];
  customFieldDefs: CustomFieldDefData[];
  /** Prossimo task aperto per opportunità (agente Task), caricato dalla pagina server. */
  nextTaskByOpportunity?: Record<string, NextTaskSummary | null>;
}) {
  const slug = useCompanySlug();
  const router = useRouter();

  // Le colonne si ricalcolano dai props ad ogni cambio di `opportunities`
  // (nuovo fetch server dopo un filtro o un refresh): aggiornamento durante il
  // render, non in un effect, cosi' non c'e' un giro di render in piu' e lo
  // stato ottimistico del drag resta coerente con l'ultimo dato server noto.
  const [columns, setColumns] = useState(() => groupByStage(stages, opportunities));
  const [syncedOpportunities, setSyncedOpportunities] = useState(opportunities);
  if (opportunities !== syncedOpportunities) {
    setSyncedOpportunities(opportunities);
    setColumns(groupByStage(stages, opportunities));
  }

  const [drawerState, setDrawerState] = useState<{ open: boolean; opp?: OpportunityCardData | null; stageId?: string }>({ open: false });
  const [wonDialog, setWonDialog] = useState<{ id: string; name: string } | null>(null);
  const [lostPending, setLostPending] = useState<{ oppId: string; name: string; stageId: string; beforeId: string | null; afterId: string | null; snapshot: typeof columns } | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState<{ id: string; name: string } | null>(null);

  async function applyMove(oppId: string, stageId: string, beforeId: string | null, afterId: string | null, lostReason: string | null, snapshot: typeof columns, stageChanged: boolean) {
    const res = await moveOpportunityAction(slug, oppId, { stageId, beforeId, afterId, lostReason });
    if (!res.ok) {
      setColumns(snapshot);
      alert(res.error);
      return;
    }
    router.refresh();
    const opp = opportunities.find(o => o.id === oppId);
    if (res.data.status === "WON") {
      setWonDialog({ id: oppId, name: opp?.name ?? "Opportunità" });
    } else if (stageChanged && res.data.status === "OPEN") {
      // Follow-up: solo dopo un cambio di fase riuscito verso una fase aperta (non WON/LOST).
      setFollowUpPrompt({ id: oppId, name: opp?.name ?? "Opportunità" });
    }
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const snapshot = columns;
    const sourceList = [...(columns[source.droppableId] ?? [])];
    const [moved] = sourceList.splice(source.index, 1);
    if (!moved) return;

    const destList = source.droppableId === destination.droppableId ? sourceList : [...(columns[destination.droppableId] ?? [])];
    destList.splice(destination.index, 0, moved);

    const next = { ...columns, [source.droppableId]: sourceList, [destination.droppableId]: destList };
    setColumns(next);

    const beforeId = destination.index > 0 ? destList[destination.index - 1].id : null;
    const afterId = destination.index < destList.length - 1 ? destList[destination.index + 1].id : null;

    const destStage = stages.find(s => s.id === destination.droppableId);
    const stageChanged = source.droppableId !== destination.droppableId;

    if (destStage?.kind === "LOST" && stageChanged) {
      setLostPending({ oppId: draggableId, name: moved.name, stageId: destination.droppableId, beforeId, afterId, snapshot });
      return;
    }

    void applyMove(draggableId, destination.droppableId, beforeId, afterId, null, snapshot, stageChanged);
  }

  const pipelineName = pipelines.find(p => p.id === currentPipelineId)?.name ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>{pipelineName}</p>
        <button
          onClick={() => setDrawerState({ open: true, opp: null, stageId: stages.find(s => s.kind === "OPEN")?.id })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-md)] text-[13px] font-medium"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuova opportunità
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: "x proximity" }}>
          {stages.map(stage => {
            const items = columns[stage.id] ?? [];
            const total = items.reduce((sum, o) => sum + o.value, 0);
            return (
              <div
                key={stage.id}
                className="shrink-0 w-[86vw] sm:w-[280px] flex flex-col rounded-[var(--r-lg)]"
                style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", scrollSnapAlign: "start", maxHeight: "calc(100vh - 260px)" }}
              >
                <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <p className="text-[13px] font-semibold flex-1 truncate" style={{ color: "var(--fg)" }}>{stage.name}</p>
                    <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>{items.length}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: "var(--fg-3)" }}>{formatCurrency(total)}</p>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 overflow-y-auto p-2 space-y-2"
                      style={{ backgroundColor: snapshot.isDraggingOver ? "var(--info-soft)" : undefined, minHeight: 80 }}
                    >
                      {items.map((opp, index) => (
                        <Draggable key={opp.id} draggableId={opp.id} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <OpportunityCard opp={opp} members={members} onClick={() => setDrawerState({ open: true, opp })} nextTask={nextTaskByOpportunity[opp.id] ?? null} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && (
                        <p className="text-center text-[11px] py-6" style={{ color: "var(--fg-3)" }}>Nessuna opportunità</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <OpportunityDrawer
        open={drawerState.open}
        onClose={() => setDrawerState({ open: false })}
        pipelines={pipelines}
        members={members}
        products={products}
        customFieldDefs={customFieldDefs}
        opportunity={drawerState.opp}
        defaultPipelineId={currentPipelineId}
        defaultStageId={drawerState.stageId}
      />

      {wonDialog && (
        <WonDialog opportunityId={wonDialog.id} opportunityName={wonDialog.name} onClose={() => setWonDialog(null)} />
      )}

      {lostPending && (
        <LostReasonDialog
          opportunityName={lostPending.name}
          onCancel={() => { setColumns(lostPending.snapshot); setLostPending(null); }}
          onConfirm={(reason) => {
            const { oppId, stageId, beforeId, afterId, snapshot } = lostPending;
            setLostPending(null);
            void applyMove(oppId, stageId, beforeId, afterId, reason, snapshot, true);
          }}
        />
      )}

      {followUpPrompt && (
        <FollowUpPrompt
          opportunityId={followUpPrompt.id}
          opportunityName={followUpPrompt.name}
          onDone={() => { setFollowUpPrompt(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
