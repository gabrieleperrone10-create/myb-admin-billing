"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreVertical, ExternalLink, Trash2, Check, ListTodo } from "lucide-react";
import type { ContactLifecycle } from "@prisma/client";
import { changeContactLifecycle, updateContactOwner, createBillingClientForContact, deleteContact } from "@/app/actions/contactDetail";
import { companyPath } from "@/lib/paths";
import { TaskFormDialog } from "@/components/crm/tasks/TaskFormDialog";

const LIFECYCLE_OPTIONS: { value: ContactLifecycle; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "CUSTOMER", label: "Cliente" },
  { value: "ARCHIVED", label: "Archiviato" },
];

/**
 * Menu azioni dell'header della scheda: cambia fase, assegna responsabile,
 * crea/apri il cliente di fatturazione collegato, elimina il contatto.
 * Proprietario: agente B.
 */
export function ContactHeaderActions({
  slug,
  contactId,
  lifecycle,
  ownerUserId,
  members,
  clientId,
  can = { viewClient: true, createClient: true, tasks: true, delete: true },
}: {
  slug: string;
  contactId: string;
  lifecycle: ContactLifecycle;
  ownerUserId: string | null;
  members: { userId: string; name: string }[];
  clientId: string | null;
  /** Azioni visibili secondo il ruolo: cio' che non e' concesso non si mostra */
  can?: { viewClient: boolean; createClient: boolean; tasks: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function doLifecycle(to: ContactLifecycle) {
    if (to === lifecycle) return;
    startTransition(async () => { await changeContactLifecycle(slug, contactId, to); });
  }

  function doOwner(userId: string) {
    startTransition(async () => { await updateContactOwner(slug, contactId, userId || null); });
  }

  function doCreateClient() {
    setError(null);
    startTransition(async () => {
      const res = await createBillingClientForContact(slug, contactId);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      if (res.clientId) router.push(companyPath(slug, `/clients/${res.clientId}`));
    });
  }

  function doDelete() {
    if (!confirm("Eliminare definitivamente questo contatto? L'operazione non è reversibile.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContact(slug, contactId);
      if (!res.ok) { setError(res.error); return; }
      router.push(companyPath(slug, "/contacts"));
    });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-[6px] hover:bg-subtle"
        style={{ color: "var(--fg-3)" }}
        aria-label="Azioni contatto"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-72 z-20 rounded-[var(--r-md)] overflow-hidden text-[13px]"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        >
          <div className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
            Fase
          </div>
          {LIFECYCLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => doLifecycle(opt.value)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-subtle"
              style={{ color: "var(--fg)" }}
            >
              {opt.label}
              {opt.value === lifecycle && <Check className="w-3.5 h-3.5" style={{ color: "var(--ok)" }} />}
            </button>
          ))}

          <div className="px-3 pt-2.5 pb-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ borderTop: "1px solid var(--border)", color: "var(--fg-3)" }}>
            Responsabile
          </div>
          <div className="px-3 pb-2">
            <select
              defaultValue={ownerUserId ?? ""}
              disabled={pending}
              onChange={e => doOwner(e.target.value)}
              className="w-full px-2 py-1.5 rounded-[6px] border text-[13px]"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
            >
              <option value="">Nessun responsabile</option>
              {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </select>
          </div>

          {can.viewClient && (clientId || can.createClient) && <div style={{ borderTop: "1px solid var(--border)" }}>
            {clientId ? (
              <Link
                href={companyPath(slug, `/clients/${clientId}`)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-subtle"
                style={{ color: "var(--fg)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Vai al cliente di fatturazione
              </Link>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={doCreateClient}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-subtle"
                style={{ color: "var(--fg)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Crea cliente di fatturazione
              </button>
            )}
          </div>}

          {can.tasks && <div style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => { setOpen(false); setTaskDialogOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-subtle"
              style={{ color: "var(--fg)" }}
            >
              <ListTodo className="w-3.5 h-3.5" /> Nuovo task / follow-up
            </button>
          </div>}

          {can.delete && <div style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              disabled={pending}
              onClick={doDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-subtle"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Elimina contatto
            </button>
          </div>}

          {error && (
            <p className="px-3 py-2 text-[12px]" style={{ borderTop: "1px solid var(--border)", color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>
      )}

      <TaskFormDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        members={members.map(m => ({ userId: m.userId, name: m.name }))}
        defaultContactId={contactId}
        onSaved={() => { setTaskDialogOpen(false); router.refresh(); }}
      />
    </div>
  );
}
