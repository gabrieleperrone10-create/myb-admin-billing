"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtEur, fmtEurAxis, fmtInt } from "@/lib/crm/reports/format";
import { SERIES } from "./vizTheme";

export type TrendPointData = { key: string; label: string; leads: number; won: number; collected: number };

/**
 * Andamento del periodo. Due grafici (mai doppio asse): conteggi (lead vs
 * vinte, linee) e incassato in € (colonne). Riceve SOLO dati: formatter e
 * tooltip sono definiti qui dentro.
 */
export function TrendCharts({
  points,
  granularityLabel,
}: {
  points: TrendPointData[];
  granularityLabel: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const hasCounts = points.some(p => p.leads > 0 || p.won > 0);
  const hasMoney = points.some(p => p.collected !== 0);
  const totalLeads = points.reduce((s, p) => s + p.leads, 0);
  const totalWon = points.reduce((s, p) => s + p.won, 0);
  const totalCollected = points.reduce((s, p) => s + p.collected, 0);

  const axisTick = { fontSize: 10, fill: "var(--rep-axis)", fontFamily: "var(--font-geist-mono, monospace)" };

  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[13px] font-medium text-fg">Andamento</p>
          <p className="text-[11px] text-fg-3">Valori {granularityLabel} · incassato per data di pagamento (clienti collegati al CRM)</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable(v => !v)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-[var(--r-md)] border border-border text-fg-2 hover:bg-subtle"
        >
          {showTable ? "Mostra grafico" : "Mostra tabella"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0" style={{ backgroundColor: "var(--surface)" }}>
              <tr className="text-left text-fg-3">
                <th className="py-1.5 pr-3 font-medium">Periodo</th>
                <th className="py-1.5 pr-3 font-medium text-right">Lead</th>
                <th className="py-1.5 pr-3 font-medium text-right">Vinte</th>
                <th className="py-1.5 font-medium text-right">Incassato</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map(p => (
                <tr key={p.key} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-fg-2">{p.label}</td>
                  <td className="py-1.5 pr-3 text-right text-fg">{fmtInt(p.leads)}</td>
                  <td className="py-1.5 pr-3 text-right text-fg">{fmtInt(p.won)}</td>
                  <td className="py-1.5 text-right text-fg">{fmtEur(p.collected)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="py-1.5 pr-3 text-fg">Totale</td>
                <td className="py-1.5 pr-3 text-right text-fg">{fmtInt(totalLeads)}</td>
                <td className="py-1.5 pr-3 text-right text-fg">{fmtInt(totalWon)}</td>
                <td className="py-1.5 text-right text-fg">{fmtEur(totalCollected)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Conteggi */}
          <div>
            <div className="flex items-center gap-4 mb-2 text-[11px] text-fg-2">
              <LegendKey color={SERIES.leads} label={`Nuovi lead · ${fmtInt(totalLeads)}`} />
              <LegendKey color={SERIES.won} label={`Opportunità vinte · ${fmtInt(totalWon)}`} />
            </div>
            <div style={{ height: 220 }}>
              {!hasCounts ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--rep-grid)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <TooltipBox title={String(label)} rows={[
                            { color: SERIES.leads, label: "Nuovi lead", value: fmtInt(Number(payload.find(p => p.dataKey === "leads")?.value ?? 0)) },
                            { color: SERIES.won, label: "Vinte", value: fmtInt(Number(payload.find(p => p.dataKey === "won")?.value ?? 0)) },
                          ]} />
                        ) : null
                      }
                      cursor={{ stroke: "var(--rep-grid)", strokeWidth: 1 }}
                    />
                    <Line type="monotone" dataKey="leads" stroke={SERIES.leads} strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: SERIES.leads, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="won" stroke={SERIES.won} strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: SERIES.won, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Incassato */}
          <div>
            <div className="flex items-center gap-4 mb-2 text-[11px] text-fg-2">
              <span>Incassato · <span className="font-medium text-fg">{fmtEur(totalCollected)}</span></span>
            </div>
            <div style={{ height: 220 }}>
              {!hasMoney ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={points} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--rep-grid)" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tickFormatter={fmtEurAxis} tick={axisTick} tickLine={false} axisLine={false} width={56} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <TooltipBox title={String(label)} rows={[
                            { color: SERIES.collected, label: "Incassato", value: fmtEur(Number(payload[0]?.value ?? 0)) },
                          ]} />
                        ) : null
                      }
                      cursor={{ fill: "var(--subtle)" }}
                    />
                    <Bar dataKey="collected" fill={SERIES.collected} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-3 h-[2px] rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { color: string; label: string; value: string }[] }) {
  return (
    <div className="rounded-[6px] px-2.5 py-2 text-[12px] shadow-sm" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] text-fg-3 mb-1">{title}</p>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-[2px] rounded-full" style={{ backgroundColor: r.color }} />
          <span className="font-semibold text-fg tabular-nums">{r.value}</span>
          <span className="text-fg-3">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-[13px] text-fg-3">Nessun dato nel periodo</p>
    </div>
  );
}
