"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, UserRound } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { TaskPriority, TaskType } from "@prisma/client";
import { useCompanySlug } from "@/lib/useCompany";
import {
  createTaskAction, updateTaskAction, searchContactsForTask, getContactBrief, listContactOpportunities,
  type PickedTaskContact, type TaskOpportunityOption,
} from "@/app/actions/tasks";
import { TASK_TYPE_LABEL, TASK_PRIORITY_LABEL, type TaskMemberOption, type TaskRow } from "./types";
import { TaskTypeIcon } from "./TaskIcons";

const TYPES: TaskType[] = ["TODO", "CALL", "EMAIL", "WHATSAPP", "MEETING"];
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH"];

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dialog di creazione/modifica task, riusabile ovunque (pagina /tasks, tab
 * contatto, kanban, drawer opportunità). Chiama le server action DENTRO al
 * client component (mai passate come prop da un Server Component): vedi
 * AGENTS.md del progetto.
 *
 * `companyTimezone` serve solo per pre-riempire correttamente data/ora in
 * modifica (la conversione autoritativa avviene lato server, in
 * app/actions/tasks.ts, quindi chi non la passa — es. ContactHeaderActions,
 * che non ha l'azienda come prop — resta comunque corretto in creazione).
 */
export function TaskFormDialog({
  open, onClose, members, currentUserId = "", companyTimezone = "Europe/Rome",
  task = null,
  defaultContact = null, defaultContactId = null, defaultOpportunityId = null, defaultType,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  members: TaskMemberOption[];
  /** Assegnatario predefinito in creazione. Facoltativo: chi non conosce l'utente corrente (es. ContactHeaderActions) lascia "Nessuno". */
  currentUserId?: string;
  companyTimezone?: string;
  task?: TaskRow | null;
  defaultContact?: PickedTaskContact | null;
  defaultContactId?: string | null;
  defaultOpportunityId?: string | null;
  defaultType?: TaskType;
  onSaved?: (task: TaskRow) => void;
}) {
  const slug = useCompanySlug();
  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState<TaskType>(task?.type ?? defaultType ?? "TODO");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "NORMAL");
  const [assigneeUserId, setAssigneeUserId] = useState(task?.assigneeUserId ?? currentUserId);
  const [contact, setContact] = useState<PickedTaskContact | null>(
    task?.contact ? { id: task.contact.id, name: task.contact.name, email: null, companyName: null } : defaultContact,
  );
  const [opportunityId, setOpportunityId] = useState(task?.opportunity?.id ?? defaultOpportunityId ?? "");
  const [opportunities, setOpportunities] = useState<TaskOpportunityOption[]>(
    task?.opportunity ? [{ id: task.opportunity.id, name: task.opportunity.name }] : [],
  );

  const initialDue = task?.dueAt
    ? { date: formatInTimeZone(new Date(task.dueAt), companyTimezone, "yyyy-MM-dd"), time: task.allDay ? "" : formatInTimeZone(new Date(task.dueAt), companyTimezone, "HH:mm") }
    : { date: "", time: "" };
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Contatto passato per solo id (es. ContactHeaderActions, che non ha nome/email a portata): lo si recupera all'apertura.
  useEffect(() => {
    if (!open) return;
    if (!contact && !task && defaultContactId) {
      void getContactBrief(slug, defaultContactId).then(c => { if (c) setContact(c); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Opportunità del contatto selezionato.
  useEffect(() => {
    if (!contact) return;
    void listContactOpportunities(slug, contact.id).then(rows => {
      setOpportunities(rows);
      setOpportunityId(prev => (prev && rows.some(r => r.id === prev) ? prev : (defaultOpportunityId && rows.some(r => r.id === defaultOpportunityId) ? defaultOpportunityId : "")));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  // Rimuovere il contatto svuota anche l'opportunità collegata (evita di inviare
  // un opportunityId orfano se il form viene salvato senza contatto).
  function handleContactChange(c: PickedTaskContact | null) {
    setContact(c);
    if (!c) { setOpportunities([]); setOpportunityId(""); }
  }

  if (!open) return null;

  function applyShortcut(days: number) {
    setDueDate(addDaysStr(todayStr(), days));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Il titolo è obbligatorio"); return; }
    setLoading(true);
    setError("");

    const input = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      priority,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      assigneeUserId: assigneeUserId || null,
      contactId: contact?.id || null,
      opportunityId: opportunityId || null,
    };

    const res = isEdit
      ? await updateTaskAction(slug, task!.id, input)
      : await createTaskAction(slug, input);

    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    onSaved?.(res.data);
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
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>{isEdit ? "Modifica task" : "Nuovo task"}</h2>
          <button onClick={onClose} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Titolo</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="es. Richiamare per il preventivo"
              autoFocus
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione (opzionale)</label>
            <textarea
              value={description ?? ""}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none resize-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-[var(--r-md)]"
                    style={{ border: "1px solid var(--border)", backgroundColor: type === t ? "var(--fg)" : "transparent", color: type === t ? "var(--surface)" : "var(--fg-2)" }}
                  >
                    <TaskTypeIcon type={t} className="w-3 h-3" /> {TASK_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Priorità</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Scadenza</label>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <button type="button" onClick={() => applyShortcut(0)} className="text-[11px] px-2 py-1 rounded-full" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>Oggi</button>
              <button type="button" onClick={() => applyShortcut(1)} className="text-[11px] px-2 py-1 rounded-full" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>Domani</button>
              <button type="button" onClick={() => applyShortcut(3)} className="text-[11px] px-2 py-1 rounded-full" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>Tra 3 giorni</button>
              <button type="button" onClick={() => applyShortcut(7)} className="text-[11px] px-2 py-1 rounded-full" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>Tra 1 settimana</button>
              {dueDate && (
                <button type="button" onClick={() => { setDueDate(""); setDueTime(""); }} className="text-[11px] px-2 py-1 rounded-full" style={{ color: "var(--danger)" }}>Rimuovi</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              />
              <input
                type="time"
                value={dueTime}
                disabled={!dueDate}
                onChange={e => setDueTime(e.target.value)}
                placeholder="Tutto il giorno"
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none disabled:opacity-40"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              />
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--fg-3)" }}>Senza ora: scadenza per l&apos;intera giornata.</p>
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Assegnatario</label>
            <select
              value={assigneeUserId ?? ""}
              onChange={e => setAssigneeUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            >
              <option value="">Nessuno</option>
              {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Contatto (opzionale)</label>
            <TaskContactField value={contact} onChange={handleContactChange} />
          </div>

          {contact && (
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Opportunità (opzionale)</label>
              <select
                value={opportunityId}
                onChange={e => setOpportunityId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
              >
                <option value="">Nessuna</option>
                {opportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
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
            {loading ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea task"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-[var(--r-md)] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </>
  );
}

/** Ricerca contatto per nome/email (limite 10, vedi searchContactsForTask). */
function TaskContactField({ value, onChange }: { value: PickedTaskContact | null; onChange: (c: PickedTaskContact | null) => void }) {
  const slug = useCompanySlug();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedTaskContact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const rows = await searchContactsForTask(slug, query);
      setResults(rows);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query, open, slug]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--r-md)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
        <div className="min-w-0 flex items-center gap-2">
          <UserRound className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{value.name}</p>
            {(value.email || value.companyName) && (
              <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>{[value.companyName, value.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <button type="button" onClick={() => onChange(null)} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setLoading(true); }}
          onFocus={() => { setOpen(true); setLoading(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Cerca contatto per nome o email…"
          className="w-full pl-8 pr-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
      </div>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-[var(--r-lg)] overflow-hidden animate-scale-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.14)", maxHeight: 240, overflowY: "auto" }}
        >
          {loading && <p className="px-3 py-2.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Ricerca…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun contatto trovato</p>}
          {!loading && results.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
              style={{ color: "var(--fg)", minHeight: "unset" }}
            >
              <span className="font-medium">{c.name}</span>
              {(c.companyName || c.email) && <span style={{ color: "var(--fg-3)" }}> · {[c.companyName, c.email].filter(Boolean).join(" · ")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
