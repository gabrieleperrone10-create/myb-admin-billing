"use client";

import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { createOpportunityFollowUpAction } from "@/app/actions/tasks";

/**
 * Toast "Pianifica follow-up?" dopo uno spostamento di fase riuscito nel
 * kanban (non WON/LOST). Un clic crea un task CALL legato a opportunità e
 * contatto, per domani/3 giorni/1 settimana (10:00, fuso azienda).
 */
export function FollowUpPrompt({
  opportunityId, opportunityName, onDone,
}: {
  opportunityId: string;
  opportunityName: string;
  onDone: () => void;
}) {
  const slug = useCompanySlug();
  const [loading, setLoading] = useState<1 | 3 | 7 | null>(null);

  async function pick(days: 1 | 3 | 7) {
    setLoading(days);
    await createOpportunityFollowUpAction(slug, opportunityId, days);
    setLoading(null);
    onDone();
  }

  return (
    <div
      className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[340px] rounded-[var(--r-lg)] p-3.5 animate-scale-in"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarClock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>Pianifica follow-up?</p>
        </div>
        <button onClick={onDone} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[11px] mb-2.5 truncate" style={{ color: "var(--fg-3)" }}>{opportunityName}</p>
      <div className="flex gap-1.5 flex-wrap">
        <button disabled={!!loading} onClick={() => pick(1)} className="text-[12px] px-2.5 py-1.5 rounded-[var(--r-md)]" style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}>
          {loading === 1 ? "…" : "Domani"}
        </button>
        <button disabled={!!loading} onClick={() => pick(3)} className="text-[12px] px-2.5 py-1.5 rounded-[var(--r-md)]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
          {loading === 3 ? "…" : "3 giorni"}
        </button>
        <button disabled={!!loading} onClick={() => pick(7)} className="text-[12px] px-2.5 py-1.5 rounded-[var(--r-md)]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
          {loading === 7 ? "…" : "1 settimana"}
        </button>
        <button disabled={!!loading} onClick={onDone} className="text-[12px] px-2.5 py-1.5 rounded-[var(--r-md)]" style={{ color: "var(--fg-3)", minHeight: "unset" }}>
          No
        </button>
      </div>
    </div>
  );
}
