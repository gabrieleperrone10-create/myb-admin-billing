"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, ExternalLink, Plus } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { formatCurrency } from "@/lib/utils";
import { createOpportunityAction, updateOpportunityAction } from "@/app/actions/opportunities";
import { listOpportunityTasksAction } from "@/app/actions/tasks";
import { TaskFormDialog } from "@/components/crm/tasks/TaskFormDialog";
import { TaskListItem } from "@/components/crm/tasks/TaskListItem";
import type { TaskRow } from "@/components/crm/tasks/types";
import { ContactPicker, type PickedContact } from "./ContactPicker";
import type { CustomFieldDefData, MemberData, OpportunityCardData, PipelineData, ProductData } from "./types";

export function OpportunityDrawer({
  open, onClose, pipelines, members, products, customFieldDefs,
  opportunity, defaultPipelineId, defaultStageId, defaultContact, onSaved,
  currentUserId = "", companyTimezone = "Europe/Rome",
}: {
  open: boolean;
  onClose: () => void;
  pipelines: PipelineData[];
  members: MemberData[];
  products: ProductData[];
  customFieldDefs: CustomFieldDefData[];
  opportunity?: OpportunityCardData | null;
  defaultPipelineId?: string;
  defaultStageId?: string;
  defaultContact?: PickedContact | null;
  onSaved?: (id: string) => void;
  /** Facoltativi (agente Task, sezione "Task" del drawer): chi non li passa mantiene il comportamento precedente. */
  currentUserId?: string;
  companyTimezone?: string;
}) {
  const slug = useCompanySlug();
  const router = useRouter();
  const isEdit = !!opportunity;

  const [contact, setContact] = useState<PickedContact | null>(
    opportunity ? { id: opportunity.contact.id, name: opportunity.contact.name, email: opportunity.contact.email, companyName: opportunity.contact.companyName } : (defaultContact ?? null),
  );
  const [name, setName] = useState(opportunity?.name ?? "");
  const [pipelineId, setPipelineId] = useState(opportunity?.pipelineId ?? defaultPipelineId ?? pipelines[0]?.id ?? "");
  const [stageId, setStageId] = useState(opportunity?.stageId ?? defaultStageId ?? "");
  const [value, setValue] = useState(opportunity ? String(opportunity.value) : "");
  const [ownerUserId, setOwnerUserId] = useState(opportunity?.ownerUserId ?? "");
  const [productId, setProductId] = useState(opportunity?.productId ?? "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(opportunity?.expectedCloseDate?.slice(0, 10) ?? "");
  const [customValues, setCustomValues] = useState<Record<string, string | boolean | string[]>>(() => {
    const init: Record<string, string | boolean | string[]> = {};
    for (const def of customFieldDefs) {
      const v = opportunity?.customFields?.[def.key];
      if (def.type === "CHECKBOX") init[def.key] = typeof v === "boolean" ? v : false;
      else if (def.type === "MULTISELECT") init[def.key] = Array.isArray(v) ? v as string[] : [];
      else init[def.key] = typeof v === "string" || typeof v === "number" ? String(v) : "";
    }
    return init;
  });
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sezione "Task" (agente Task): elenco + creazione, solo quando l'opportunità esiste già.
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    if (!open || !opportunity) return;
    void listOpportunityTasksAction(slug, opportunity.id).then(setTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity?.id]);

  const pipeline = pipelines.find(p => p.id === pipelineId);
  const stages = pipeline?.stages ?? [];
  const currentStageId = stages.some(s => s.id === stageId) ? stageId : (stages[0]?.id ?? "");

  if (!open) return null;

  function refreshTasks() {
    if (opportunity) void listOpportunityTasksAction(slug, opportunity.id).then(setTasks);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contact) { setError("Seleziona o crea un contatto"); return; }
    if (!currentStageId) { setError("Seleziona una fase"); return; }
    setLoading(true);
    setError("");

    const customFields: Record<string, unknown> = {};
    for (const def of customFieldDefs) customFields[def.key] = customValues[def.key];

    const input = {
      contactId: contact.id,
      pipelineId,
      stageId: currentStageId,
      name: name.trim() || undefined,
      value: value.trim() ? parseFloat(value) : 0,
      ownerUserId: ownerUserId || null,
      productId: productId || null,
      expectedCloseDate: expectedCloseDate || null,
      customFields,
      note: note.trim() || undefined,
    };

    const res = isEdit
      ? await updateOpportunityAction(slug, opportunity!.id, input)
      : await createOpportunityAction(slug, input);

    setLoading(false);
    if (!res.ok) { setError(res.error); return; }

    router.refresh();
    onSaved?.(isEdit ? opportunity!.id : (res.data as { id: string }).id);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div
        className="fixed z-50 top-0 right-0 h-full w-full sm:w-[440px] flex flex-col animate-slide-up sm:animate-none"
        style={{ backgroundColor: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
            {isEdit ? "Modifica opportunità" : "Nuova opportunità"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Contatto</label>
            <ContactPicker value={contact} onChange={setContact} />
            {contact && (
              <Link href={`/${slug}/contacts/${contact.id}`} target="_blank" className="inline-flex items-center gap-1 mt-1 text-[11px]" style={{ color: "var(--info)" }}>
                Apri scheda contatto <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome opportunità (opzionale)</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={contact ? contact.name : "es. Rinnovo annuale"}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Pipeline</label>
              <select
                value={pipelineId}
                onChange={e => { setPipelineId(e.target.value); setStageId(""); }}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Fase</label>
              <select
                value={currentStageId}
                onChange={e => setStageId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Valore (EUR)</label>
              <input
                type="number" step="0.01" min="0"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Responsabile</label>
              <select
                value={ownerUserId}
                onChange={e => setOwnerUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                <option value="">Nessuno</option>
                {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Prodotto / Servizio</label>
            <select
              value={productId}
              onChange={e => {
                setProductId(e.target.value);
                const p = products.find(pr => pr.id === e.target.value);
                if (p && !value.trim()) setValue(String(p.basePrice));
              }}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            >
              <option value="">Nessuno</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.basePrice)})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Data chiusura prevista</label>
            <input
              type="date"
              value={expectedCloseDate}
              onChange={e => setExpectedCloseDate(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          {customFieldDefs.length > 0 && (
            <div className="space-y-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="font-mono text-[10px] uppercase tracking-table-head pt-3" style={{ color: "var(--fg-3)" }}>Campi personalizzati</p>
              {customFieldDefs.map(def => (
                <CustomFieldInput
                  key={def.id}
                  def={def}
                  value={customValues[def.key]}
                  onChange={v => setCustomValues(prev => ({ ...prev, [def.key]: v }))}
                />
              ))}
            </div>
          )}

          <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <label className="block text-[12px] font-medium mb-1 pt-3" style={{ color: "var(--fg-2)" }}>Nota rapida (opzionale)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Aggiungi una nota alla cronologia del contatto…"
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none resize-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          {isEdit && opportunity && (
            <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between pt-3 mb-2">
                <p className="font-mono text-[10px] uppercase tracking-table-head" style={{ color: "var(--fg-3)" }}>Task</p>
                <button
                  type="button"
                  onClick={() => setTaskDialogOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: "var(--info)", minHeight: "unset" }}
                >
                  <Plus className="w-3 h-3" /> Nuovo task
                </button>
              </div>
              {tasks.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun task collegato</p>
              ) : (
                <div className="space-y-1.5">
                  {tasks.map(t => (
                    <TaskListItem key={t.id} task={t} members={members.map(m => ({ userId: m.userId, name: m.name }))} onEdit={setEditingTask} showContact={false} onChanged={refreshTasks} />
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-[var(--r-md)] text-[12px]" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>
          )}
        </form>

        <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
          >
            {loading ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea opportunità"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>

      {isEdit && opportunity && (
        <>
          <TaskFormDialog
            key={`create-${opportunity.id}`}
            open={taskDialogOpen}
            onClose={() => setTaskDialogOpen(false)}
            members={members.map(m => ({ userId: m.userId, name: m.name }))}
            currentUserId={currentUserId}
            companyTimezone={companyTimezone}
            defaultContactId={opportunity.contact.id}
            defaultOpportunityId={opportunity.id}
            onSaved={() => { setTaskDialogOpen(false); refreshTasks(); }}
          />
          <TaskFormDialog
            key={editingTask?.id ?? "edit"}
            open={!!editingTask}
            onClose={() => setEditingTask(null)}
            members={members.map(m => ({ userId: m.userId, name: m.name }))}
            currentUserId={currentUserId}
            companyTimezone={companyTimezone}
            task={editingTask}
            onSaved={() => { setEditingTask(null); refreshTasks(); }}
          />
        </>
      )}
    </>
  );
}

function CustomFieldInput({
  def, value, onChange,
}: {
  def: CustomFieldDefData;
  value: string | boolean | string[];
  onChange: (v: string | boolean | string[]) => void;
}) {
  const label = def.label + (def.required ? " *" : "");
  if (def.type === "CHECKBOX") {
    return (
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="rounded" />
        {label}
      </label>
    );
  }
  if (def.type === "SELECT") {
    return (
      <div>
        <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>{label}</label>
        <select
          value={typeof value === "string" ? value : ""}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        >
          <option value="">—</option>
          {def.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (def.type === "MULTISELECT") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>{label}</label>
        <div className="flex flex-wrap gap-1.5">
          {def.options.map(o => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? selected.filter(x => x !== o) : [...selected, o])}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: on ? "var(--fg)" : "transparent",
                  color: on ? "var(--surface)" : "var(--fg-2)",
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (def.type === "TEXTAREA") {
    return (
      <div>
        <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>{label}</label>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={e => onChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
      </div>
    );
  }
  const inputType = def.type === "NUMBER" ? "number" : def.type === "DATE" ? "date" : def.type === "EMAIL" ? "email" : def.type === "URL" ? "url" : "text";
  return (
    <div>
      <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>{label}</label>
      <input
        type={inputType}
        value={typeof value === "string" ? value : ""}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      />
    </div>
  );
}
