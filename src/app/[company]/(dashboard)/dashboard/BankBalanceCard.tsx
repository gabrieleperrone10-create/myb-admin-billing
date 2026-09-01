"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { updateBankBalance } from "@/app/actions/settings";
import { useCompanySlug } from "@/lib/useCompany";
import { formatCurrency } from "@/lib/utils";

export function BankBalanceCard({
  bankBalance,
  bankBalanceAt,
  estimatedBalance,
}: {
  bankBalance: number | null;
  bankBalanceAt: Date | null;
  estimatedBalance: number | null;
}) {
  const slug = useCompanySlug();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(bankBalance !== null ? String(bankBalance) : "");
  const [pending, startTransition] = useTransition();

  const delta = estimatedBalance !== null && bankBalance !== null ? estimatedBalance - bankBalance : null;

  function handleSave() {
    const parsed = parseFloat(inputVal.replace(",", "."));
    if (isNaN(parsed)) return;
    startTransition(async () => {
      await updateBankBalance(slug, parsed);
      setEditing(false);
    });
  }

  const updatedLabel = bankBalanceAt
    ? new Date(bankBalanceAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      className="rounded-[var(--r-lg)] p-4 md:p-[18px] flex flex-col gap-3"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>
          SALDO CC{updatedLabel ? ` · agg. ${updatedLabel}` : ""}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(e => !e)}
            className="p-1 rounded"
            style={{ color: "var(--fg-3)", backgroundColor: "transparent", border: "none", minHeight: "unset" }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisible(v => !v)}
            className="p-1 rounded"
            style={{ color: "var(--fg-3)", backgroundColor: "transparent", border: "none", minHeight: "unset" }}
          >
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Es. 12450.00"
            className="flex-1 px-2.5 py-1.5 rounded-[var(--r-sm)] text-[13px] font-mono"
            style={{
              backgroundColor: "var(--subtle)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
              outline: "none",
            }}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          <button onClick={handleSave} disabled={pending}
            className="p-1.5 rounded"
            style={{ backgroundColor: "#10b98120", border: "1px solid #10b98140", color: "#10b981", minHeight: "unset" }}>
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)}
            className="p-1.5 rounded"
            style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg-3)", minHeight: "unset" }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Balance display */}
      {bankBalance === null && !editing ? (
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Nessun saldo impostato —{" "}
          <button onClick={() => setEditing(true)} style={{ color: "var(--info)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}>
            imposta ora
          </button>
        </p>
      ) : (
        <div className="space-y-2">
          {/* Saldo impostato */}
          <div>
            <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>Saldo inserito</p>
            <p className="font-mono font-semibold tabular-nums" style={{ fontSize: 22, color: "var(--fg)", letterSpacing: "-0.02em" }}>
              {visible ? (bankBalance !== null ? formatCurrency(bankBalance) : "—") : "••••••"}
            </p>
          </div>

          {/* Delta */}
          {delta !== null && (
            <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--subtle)" }}>
              <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>Movimenti da agg.</p>
              <p className="font-mono text-[12px] tabular-nums font-medium" style={{ color: delta >= 0 ? "#10b981" : "#ef4444" }}>
                {visible ? `${delta >= 0 ? "+" : ""}${formatCurrency(delta)}` : "••••"}
              </p>
            </div>
          )}

          {/* Saldo stimato */}
          {estimatedBalance !== null && (
            <div className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2"
              style={{ backgroundColor: "var(--subtle)" }}>
              <p className="text-[11px] font-medium" style={{ color: "var(--fg-2)" }}>Disponibile stimato</p>
              <p className="font-mono text-[13px] font-bold tabular-nums" style={{ color: estimatedBalance >= 0 ? "#10b981" : "#ef4444" }}>
                {visible ? formatCurrency(estimatedBalance) : "••••••"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
