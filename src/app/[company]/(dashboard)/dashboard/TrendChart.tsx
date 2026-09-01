"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "12m", label: "12m" },
  { key: "6m",  label: "6m"  },
  { key: "3m",  label: "3m"  },
  { key: "30g", label: "30g" },
] as const;
type Tab = typeof TABS[number]["key"];

const fmtEur = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
  return v === 0 ? "0" : `€${v}`;
}

interface TrendPoint { period: string; label: string; amount: number; expenses: number }

interface Props {
  monthly: TrendPoint[];
  daily:   TrendPoint[];
}

export default function TrendChart({ monthly, daily }: Props) {
  const [tab, setTab] = useState<Tab>("12m");
  const [showExpenses, setShowExpenses] = useState(true);

  const data: TrendPoint[] =
    tab === "30g" ? daily :
    tab === "3m"  ? monthly.slice(-3) :
    tab === "6m"  ? monthly.slice(-6) :
    monthly;

  const hasData = data.some((d) => d.amount > 0 || d.expenses > 0);

  return (
    <div
      className="rounded-[8px] p-[18px]"
      style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>Andamento entrate / uscite</p>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
              {tab === "12m" ? "Ultimi 12 mesi" : tab === "6m" ? "Ultimi 6 mesi" : tab === "3m" ? "Ultimi 3 mesi" : "Ultimi 30 giorni"} · valori netti
            </p>
            {/* Toggle expenses overlay */}
            <button
              onClick={() => setShowExpenses(v => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-mono"
              style={{ color: showExpenses ? "#dc4040" : "var(--fg-3)" }}
            >
              <span
                className="w-2 h-2 rounded-sm inline-block"
                style={{ backgroundColor: showExpenses ? "#dc404030" : "var(--subtle)", border: `1px solid ${showExpenses ? "#dc4040" : "var(--border)"}` }}
              />
              SPESE
            </button>
          </div>
        </div>

        {/* Range tabs */}
        <div className="flex items-center rounded-[6px] p-[2px]" style={{ backgroundColor: "var(--subtle)" }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-2.5 py-1 rounded-[4px] font-mono text-[11px] font-medium transition-colors",
                tab === key ? "bg-white shadow-sm" : "hover:bg-white/60"
              )}
              style={{
                color: tab === key ? "var(--fg)" : "var(--fg-3)",
                boxShadow: tab === key ? "0 1px 2px rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.03)" : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ height: 200, marginTop: 16 }}>
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-medium" style={{ color: "var(--fg-3)" }}>Nessun dato nel periodo</p>
            <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
              Cambia il periodo o emetti la prima fattura del mese.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b9e6a" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3b9e6a" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="areaExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc4040" stopOpacity={0.14} />
                  <stop offset="95%" stopColor="#dc4040" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="oklch(0.93 0.005 80)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "oklch(0.62 0.005 80)", fontFamily: "var(--font-geist-mono, monospace)" }}
                tickLine={false} axisLine={false} interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 10, fill: "oklch(0.62 0.005 80)", fontFamily: "var(--font-geist-mono, monospace)" }}
                tickLine={false} axisLine={false} width={56}
              />
              <Tooltip
                formatter={(v, name) => [fmtEur(Number(v)), name === "amount" ? "Entrate" : "Uscite"]}
                contentStyle={{
                  borderRadius: "6px",
                  border: "1px solid oklch(0.93 0.005 80)",
                  fontSize: "12px",
                  fontFamily: "var(--font-inter-tight, system-ui)",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
                cursor={{ stroke: "oklch(0.93 0.005 80)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3b9e6a"
                strokeWidth={1.6}
                fill="url(#areaRev)"
                dot={false}
                activeDot={{ r: 3, fill: "#3b9e6a", strokeWidth: 0 }}
              />
              {showExpenses && tab !== "30g" && (
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#dc4040"
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                  fill="url(#areaExp)"
                  dot={false}
                  activeDot={{ r: 3, fill: "#dc4040", strokeWidth: 0 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
