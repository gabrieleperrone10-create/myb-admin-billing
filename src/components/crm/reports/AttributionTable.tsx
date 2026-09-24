"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { fmtEur, fmtInt, fmtPct, fmtRoas } from "@/lib/crm/reports/format";
import type { AttributionMetrics, SourceRow } from "@/lib/crm/reports/attribution";

type SortKey = keyof AttributionMetrics | "label";

const COLUMNS: { key: SortKey; label: string; title?: string; fmt: (m: AttributionMetrics) => string }[] = [
  { key: "leads", label: "Lead", fmt: m => fmtInt(m.leads) },
  { key: "opportunities", label: "Opportunità", fmt: m => fmtInt(m.opportunities) },
  { key: "won", label: "Vinte", fmt: m => fmtInt(m.won) },
  { key: "wonValue", label: "Valore vinto", fmt: m => fmtEur(m.wonValue) },
  { key: "collected", label: "Incassato", title: "Incassato ad oggi dai lead del periodo", fmt: m => fmtEur(m.collected) },
  { key: "spend", label: "Spesa", title: "Spesa del periodo, ripartita pro-rata sui giorni", fmt: m => fmtEur(m.spend) },
  { key: "cpl", label: "CPL", title: "Costo per lead = spesa / lead", fmt: m => fmtEur(m.cpl) },
  { key: "cac", label: "CAC", title: "Costo di acquisizione cliente = spesa / clienti", fmt: m => fmtEur(m.cac) },
  { key: "roas", label: "ROAS", title: "Incassato / spesa", fmt: m => fmtRoas(m.roas) },
  { key: "leadToCustomer", label: "Lead → cliente", fmt: m => fmtPct(m.leadToCustomer) },
];

function cmp(a: AttributionMetrics & { label: string }, b: AttributionMetrics & { label: string }, key: SortKey, dir: 1 | -1) {
  if (key === "label") return a.label.localeCompare(b.label, "it") * dir;
  const va = a[key], vb = b[key];
  // i valori non definiti (—) stanno sempre in fondo
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return ((va as number) - (vb as number)) * dir;
}

/** CSV con ";" e decimali con virgola: si apre direttamente in Excel italiano. */
function toCsv(rows: SourceRow[]): string {
  const num = (n: number | null, digits = 2) => (n === null ? "" : n.toFixed(digits).replace(".", ","));
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = ["Fonte", "Campagna", "Lead", "Opportunità", "Vinte", "Valore vinto", "Incassato", "Spesa", "CPL", "CAC", "ROAS", "Lead→cliente %"];
  const line = (src: string, camp: string, m: AttributionMetrics) => [
    esc(src), esc(camp), String(m.leads), String(m.opportunities), String(m.won),
    num(m.wonValue), num(m.collected), num(m.spend), num(m.cpl), num(m.cac), num(m.roas), num(m.leadToCustomer, 1),
  ].join(";");
  const out = [header.join(";")];
  for (const r of rows) {
    out.push(line(r.label, "(totale fonte)", r));
    for (const c of r.campaigns) out.push(line(r.label, c.label, c));
  }
  return "﻿" + out.join("\r\n");
}

export function AttributionTable({ rows, totals, fileName }: { rows: SourceRow[]; totals: AttributionMetrics; fileName: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("collected");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...rows]
      .sort((a, b) => cmp(a, b, sortKey, dir))
      .map(r => ({ ...r, campaigns: [...r.campaigns].sort((a, b) => cmp(a, b, sortKey, dir)) })),
    [rows, sortKey, dir],
  );

  function sortBy(k: SortKey) {
    if (k === sortKey) setDir(d => (d === 1 ? -1 : 1));
    else { setSortKey(k); setDir(k === "label" ? 1 : -1); }
  }

  function toggle(key: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const arrow = (k: SortKey) => (k === sortKey ? (dir === -1 ? " ↓" : " ↑") : "");
  const th = "py-2 px-2 font-medium text-right whitespace-nowrap cursor-pointer select-none hover:text-fg";

  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[13px] font-medium text-fg">Attribuzione per fonte e campagna</p>
          <p className="text-[11px] text-fg-3">Clicca una fonte per vedere le campagne · clicca un&apos;intestazione per ordinare</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-[var(--r-md)] border border-border text-fg-2 hover:bg-subtle disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> Esporta CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-fg-3 py-10 text-center">Nessun dato nel periodo</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12px] min-w-[980px]">
            <thead>
              <tr className="text-fg-3 border-b border-border">
                <th className="py-2 px-2 font-medium text-left cursor-pointer select-none hover:text-fg" onClick={() => sortBy("label")} aria-sort={sortKey === "label" ? (dir === 1 ? "ascending" : "descending") : "none"}>
                  Fonte / campagna{arrow("label")}
                </th>
                {COLUMNS.map(c => (
                  <th key={c.key} className={th} title={c.title} onClick={() => sortBy(c.key)}
                    aria-sort={sortKey === c.key ? (dir === 1 ? "ascending" : "descending") : "none"}>
                    {c.label}{arrow(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sorted.map(r => {
                const isOpen = open.has(r.key);
                return (
                  <Fragment key={r.key}>
                    <tr className="border-b border-border hover:bg-subtle/60 cursor-pointer" onClick={() => toggle(r.key)}>
                      <td className="py-2 px-2 text-fg font-medium">
                        <button type="button" className="inline-flex items-center gap-1 text-left" aria-expanded={isOpen}
                          onClick={e => { e.stopPropagation(); toggle(r.key); }}>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-fg-3" /> : <ChevronRight className="w-3.5 h-3.5 text-fg-3" />}
                          {r.label}
                          <span className="text-fg-3 font-normal ml-1">({r.campaigns.length})</span>
                        </button>
                      </td>
                      {COLUMNS.map(c => <td key={c.key} className="py-2 px-2 text-right text-fg">{c.fmt(r)}</td>)}
                    </tr>
                    {isOpen && r.campaigns.map(c => (
                      <tr key={`${r.key}::${c.key}`} className="border-b border-border bg-subtle/40">
                        <td className="py-1.5 px-2 pl-8 text-fg-2 max-w-[260px] truncate" title={c.label}>{c.label}</td>
                        {COLUMNS.map(col => <td key={col.key} className="py-1.5 px-2 text-right text-fg-2">{col.fmt(c)}</td>)}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              <tr className="font-semibold">
                <td className="py-2 px-2 text-fg">Totale</td>
                {COLUMNS.map(c => <td key={c.key} className="py-2 px-2 text-right text-fg">{c.fmt(totals)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
