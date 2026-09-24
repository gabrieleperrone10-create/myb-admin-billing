"use client";

import { useMemo, useState, useTransition } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Pencil, Trash2, Star, GripVertical, X, Check } from "lucide-react";
import type { Pipeline, PipelineStage, StageKind } from "@prisma/client";
import {
  createPipeline, renamePipeline, setDefaultPipeline, deletePipeline,
  createStage, updateStage, deleteStage, reorderStages,
} from "@/app/actions/pipelines";

type StageWithCount = PipelineStage & { _count: { opportunities: number } };
type PipelineWithStages = Pipeline & { stages: StageWithCount[]; _count: { opportunities: number } };

const KIND_LABEL: Record<StageKind, string> = { OPEN: "Aperta", WON: "Vinta", LOST: "Persa" };
const KIND_VARIANT: Record<StageKind, string> = { OPEN: "var(--info)", WON: "var(--ok)", LOST: "var(--danger)" };
const COLOR_SWATCHES = ["#94a3b8", "#60a5fa", "#4f7deb", "#a78bfa", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#6b7280"];

export default function PipelinesClient({ slug, pipelines }: { slug: string; pipelines: PipelineWithStages[] }) {
  const [activeId, setActiveId] = useState<string>(() => pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState<Pipeline | null>(null);
  const [stageModal, setStageModal] = useState<{ mode: "create" | "edit"; pipelineId: string; stage?: StageWithCount } | null>(null);
  const [deleteStageModal, setDeleteStageModal] = useState<StageWithCount | null>(null);
  const [error, setError] = useState("");

  const active = pipelines.find(p => p.id === activeId) ?? pipelines[0];
  // Ordine locale ottimistico per il drag: viene sostituito dai props aggiornati al prossimo render server.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const orderedStages = useMemo(() => {
    if (!active) return [];
    if (!localOrder) return active.stages;
    const byId = new Map(active.stages.map(s => [s.id, s]));
    return localOrder.map(id => byId.get(id)).filter((s): s is StageWithCount => !!s);
  }, [active, localOrder]);

  if (!active) return <p className="text-[13px] text-fg-3">Nessuna pipeline.</p>;

  function handleDragEnd(result: DropResult) {
    if (!result.destination || !active) return;
    const ids = active.stages.map(s => s.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    setLocalOrder(ids);
    startTransition(async () => {
      const res = await reorderStages(slug, active.id, ids);
      if (!res.ok) { setError(res.error); setLocalOrder(null); }
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="px-3 py-2 rounded-[var(--r-md)] text-[13px]" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* Tabs pipeline */}
      <div className="flex items-center gap-2 flex-wrap">
        {pipelines.map(p => (
          <button
            key={p.id}
            onClick={() => { setActiveId(p.id); setLocalOrder(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: p.id === activeId ? "var(--fg)" : "var(--surface)",
              color: p.id === activeId ? "var(--surface)" : "var(--fg-2)",
              border: "1px solid var(--border)",
              minHeight: "unset",
            }}
          >
            {p.isDefault && <Star className="w-3 h-3 shrink-0" fill="currentColor" />}
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setNewPipelineOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-medium"
          style={{ border: "1px dashed var(--border)", color: "var(--fg-3)", minHeight: "unset" }}
        >
          <Plus className="w-3.5 h-3.5" /> Nuova pipeline
        </button>
      </div>

      {/* Azioni pipeline attiva */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-[var(--r-lg)]" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{active.name}</p>
          <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>{active._count.opportunities} opportunità in questa pipeline</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!active.isDefault && (
            <button
              disabled={pending}
              onClick={() => startTransition(async () => {
                const res = await setDefaultPipeline(slug, active.id);
                if (!res.ok) setError(res.error);
              })}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px]"
              style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
            >
              <Star className="w-3.5 h-3.5" /> Rendi predefinita
            </button>
          )}
          <button
            onClick={() => setRenameOpen(active)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px]"
            style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
          >
            <Pencil className="w-3.5 h-3.5" /> Rinomina
          </button>
          {pipelines.length > 1 && (
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm(`Eliminare la pipeline "${active.name}"?`)) return;
                startTransition(async () => {
                  const res = await deletePipeline(slug, active.id);
                  if (!res.ok) setError(res.error);
                  else setActiveId(pipelines.find(p => p.id !== active.id)?.id ?? "");
                });
              }}
              className="flex items-center justify-center rounded-[var(--r-md)]"
              style={{ width: 32, height: 32, border: "1px solid var(--border)", color: "var(--danger)", minHeight: "unset", minWidth: "unset" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fasi (drag per riordinare) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-table-head" style={{ color: "var(--fg-3)" }}>Fasi</p>
          <button
            onClick={() => setStageModal({ mode: "create", pipelineId: active.id })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium"
            style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nuova fase
          </button>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="stages">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {orderedStages.map((stage, index) => (
                  <Draggable key={stage.id} draggableId={stage.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-lg)]"
                        style={{
                          backgroundColor: "var(--surface)",
                          border: "1px solid var(--border)",
                          boxShadow: snapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
                          ...dragProvided.draggableProps.style,
                        }}
                      >
                        <span {...dragProvided.dragHandleProps} style={{ color: "var(--fg-3)", cursor: "grab" }}>
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{stage.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
                            {stage._count.opportunities} opportunità
                            {stage.probability !== null && ` · ${stage.probability}% probabilità`}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase"
                          style={{ color: KIND_VARIANT[stage.kind], backgroundColor: `${KIND_VARIANT[stage.kind]}18` }}
                        >
                          {KIND_LABEL[stage.kind]}
                        </span>
                        <button
                          onClick={() => setStageModal({ mode: "edit", pipelineId: active.id, stage })}
                          className="flex items-center justify-center rounded-[var(--r-md)]"
                          style={{ width: 30, height: 30, color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteStageModal(stage)}
                          className="flex items-center justify-center rounded-[var(--r-md)]"
                          style={{ width: 30, height: 30, color: "var(--danger)", minHeight: "unset", minWidth: "unset" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {newPipelineOpen && (
        <NewPipelineModal slug={slug} onClose={() => setNewPipelineOpen(false)} onCreated={id => { setActiveId(id); setNewPipelineOpen(false); }} />
      )}
      {renameOpen && (
        <RenamePipelineModal slug={slug} pipeline={renameOpen} onClose={() => setRenameOpen(null)} />
      )}
      {stageModal && (
        <StageModal
          slug={slug}
          pipelineId={stageModal.pipelineId}
          stage={stageModal.stage}
          onClose={() => setStageModal(null)}
        />
      )}
      {deleteStageModal && (
        <DeleteStageModal
          slug={slug}
          stage={deleteStageModal}
          otherStages={active.stages.filter(s => s.id !== deleteStageModal.id)}
          onClose={() => setDeleteStageModal(null)}
        />
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-50 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div
        className="fixed z-50 left-1/2 w-full max-w-sm"
        style={{
          top: "50%", transform: "translate(-50%, -50%)",
          backgroundColor: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </>
  );
}

function NewPipelineModal({ slug, onClose, onCreated }: { slug: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await createPipeline(slug, name.trim());
    setLoading(false);
    if (res.ok) onCreated(res.data.id);
    else setError(res.error);
  }

  return (
    <ModalShell title="Nuova pipeline" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="es. Vendite Servizio X"
            autoFocus
            className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--fg-3)" }}>Viene creata con tre fasi di partenza: In corso, Vinta, Persa.</p>
        </div>
        {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: name.trim() && !loading ? "var(--fg)" : "var(--subtle)", color: name.trim() && !loading ? "var(--surface)" : "var(--fg-3)", minHeight: "unset" }}
          >
            {loading ? "Creazione..." : "Crea"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function RenamePipelineModal({ slug, pipeline, onClose }: { slug: string; pipeline: Pipeline; onClose: () => void }) {
  const [name, setName] = useState(pipeline.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await renamePipeline(slug, pipeline.id, name.trim());
    setLoading(false);
    if (res.ok) onClose();
    else setError(res.error);
  }

  return (
    <ModalShell title="Rinomina pipeline" onClose={onClose}>
      <div className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
        />
        {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: name.trim() && !loading ? "var(--fg)" : "var(--subtle)", color: name.trim() && !loading ? "var(--surface)" : "var(--fg-3)", minHeight: "unset" }}
          >
            {loading ? "Salvataggio..." : "Salva"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function StageModal({
  slug, pipelineId, stage, onClose,
}: {
  slug: string; pipelineId: string; stage?: StageWithCount; onClose: () => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [color, setColor] = useState(stage?.color ?? COLOR_SWATCHES[0]);
  const [kind, setKind] = useState<StageKind>(stage?.kind ?? "OPEN");
  const [probability, setProbability] = useState(stage?.probability?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    const input = {
      name: name.trim(),
      color,
      kind,
      probability: probability.trim() ? Math.max(0, Math.min(100, parseInt(probability, 10))) : null,
    };
    const res = stage
      ? await updateStage(slug, stage.id, input)
      : await createStage(slug, pipelineId, input);
    setLoading(false);
    if (res.ok) onClose();
    else setError(res.error);
  }

  return (
    <ModalShell title={stage ? "Modifica fase" : "Nuova fase"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="es. Proposta inviata"
            className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Tipo</label>
          <div className="flex gap-2">
            {(["OPEN", "WON", "LOST"] as StageKind[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="flex-1 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium"
                style={{
                  border: `1px solid ${kind === k ? KIND_VARIANT[k] : "var(--border)"}`,
                  backgroundColor: kind === k ? `${KIND_VARIANT[k]}18` : "transparent",
                  color: kind === k ? KIND_VARIANT[k] : "var(--fg-2)",
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Probabilità di chiusura (opzionale, 0–100%)</label>
          <input
            type="number" min={0} max={100} value={probability}
            onChange={e => setProbability(e.target.value)}
            placeholder="es. 50"
            className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
          />
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--fg-2)" }}>Colore</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_SWATCHES.map(c => (
              <button
                key={c} type="button" onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2, minHeight: "unset", minWidth: "unset" }}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: name.trim() && !loading ? "var(--fg)" : "var(--subtle)", color: name.trim() && !loading ? "var(--surface)" : "var(--fg-3)", minHeight: "unset" }}
          >
            {loading ? "Salvataggio..." : stage ? "Salva" : "Crea fase"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DeleteStageModal({
  slug, stage, otherStages, onClose,
}: {
  slug: string; stage: StageWithCount; otherStages: StageWithCount[]; onClose: () => void;
}) {
  const [moveTo, setMoveTo] = useState(otherStages[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasOpportunities = stage._count.opportunities > 0;

  async function submit() {
    setLoading(true);
    setError("");
    const res = await deleteStage(slug, stage.id, hasOpportunities ? moveTo : undefined);
    setLoading(false);
    if (res.ok) onClose();
    else setError(res.error);
  }

  return (
    <ModalShell title={`Eliminare "${stage.name}"?`} onClose={onClose}>
      <div className="space-y-4">
        {hasOpportunities ? (
          <>
            <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>
              Questa fase ha <strong>{stage._count.opportunities}</strong> opportunità. Scegli dove spostarle prima di eliminarla.
            </p>
            {otherStages.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--danger)" }}>Non ci sono altre fasi in questa pipeline in cui spostarle.</p>
            ) : (
              <select
                value={moveTo}
                onChange={e => setMoveTo(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
              >
                {otherStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>Questa fase non ha opportunità: puoi eliminarla senza conseguenze.</p>
        )}
        {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={loading || (hasOpportunities && otherStages.length === 0)}
            className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: "var(--danger)", color: "#fff", minHeight: "unset" }}
          >
            {loading ? "Eliminazione..." : "Elimina fase"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
