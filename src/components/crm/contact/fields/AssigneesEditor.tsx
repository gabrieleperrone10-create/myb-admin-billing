"use client";

import { useState, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { setContactAssignees } from "@/app/actions/contactDetail";

const MAX_ASSIGNEES = 20;

type Member = { userId: string; name: string };

/**
 * Assegnatari del contatto, oltre al responsabile (Contact.ownerUserId):
 * chip rimovibili + menu per aggiungerne altri. Salvataggio immediato,
 * come TagsEditor: ogni tocco chiama setContactAssignees con l'insieme
 * completo aggiornato.
 */
export function AssigneesEditor({
  slug,
  contactId,
  assignees,
  members,
}: {
  slug: string;
  contactId: string;
  assignees: Member[];
  members: Member[];
}) {
  const [current, setCurrent] = useState<Member[]>(assignees);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = members.filter(m => !current.some(c => c.userId === m.userId));

  function save(next: Member[]) {
    setError(null);
    const prev = current;
    setCurrent(next);
    startTransition(async () => {
      const res = await setContactAssignees(slug, contactId, next.map(m => m.userId));
      if (!res.ok) {
        setError(res.error);
        setCurrent(prev);
      }
    });
  }

  function add(member: Member) {
    if (current.length >= MAX_ASSIGNEES) {
      setError(`Massimo ${MAX_ASSIGNEES} assegnatari`);
      return;
    }
    setAdding(false);
    save([...current, member]);
  }

  function remove(userId: string) {
    save(current.filter(m => m.userId !== userId));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {current.map(m => (
          <span
            key={m.userId}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}
          >
            {m.name}
            <button
              type="button"
              onClick={() => remove(m.userId)}
              disabled={pending}
              aria-label={`Rimuovi ${m.name}`}
              className="hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {current.length === 0 && (
          <span className="text-[12px] italic" style={{ color: "var(--fg-3)" }}>Nessun assegnatario</span>
        )}
        {!adding && remaining.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--fg-2)" }}
          >
            <Plus className="w-3 h-3" /> Aggiungi
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-2 max-h-[200px] overflow-y-auto space-y-0.5 p-2 rounded-[8px]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
          {remaining.map(m => (
            <button
              key={m.userId}
              type="button"
              disabled={pending}
              onClick={() => add(m)}
              className="w-full text-left px-2 py-1 text-[12px] rounded-[6px] hover:bg-black/5"
              style={{ color: "var(--fg)" }}
            >
              {m.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="w-full text-left px-2 py-1 text-[11px]"
            style={{ color: "var(--fg-3)" }}
          >
            Chiudi
          </button>
        </div>
      )}

      {error && <p className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
