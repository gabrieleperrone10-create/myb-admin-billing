"use client";

import { useState } from "react";

export function LostReasonDialog({
  opportunityName, onConfirm, onCancel,
}: {
  opportunityName: string;
  onConfirm: (reason: string | null) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <>
      <div className="fixed inset-0 z-[60] animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel} />
      <div
        className="fixed z-[60] left-1/2 w-full max-w-sm"
        style={{
          top: "50%", transform: "translate(-50%, -50%)",
          backgroundColor: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--fg)" }}>Segna come persa</h2>
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Perché &ldquo;{opportunityName}&rdquo; non si è chiusa? (opzionale)
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
          rows={3}
          placeholder="es. Budget insufficiente, ha scelto un concorrente…"
          className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onConfirm(reason.trim() || null)}
            className="flex-1 py-2.5 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: "var(--danger)", color: "#fff", minHeight: "unset" }}
          >
            Segna come persa
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-[var(--r-md)] text-[13px]"
            style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
          >
            Annulla
          </button>
        </div>
      </div>
    </>
  );
}
