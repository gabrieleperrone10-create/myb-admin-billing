"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* Approximate token colors for SVG/canvas contexts */
const C = {
  info:       "#4f7deb",
  infoAlpha:  "#4f7deb1e",
  ok:         "#3b9e6a",
  warn:       "#c7922a",
  fg3:        "#9da3a4",
  border:     "#e8eae6",
  subtle:     "#f7f6f4",
  surface:    "#ffffff",
};

const METHOD_COLORS = [C.info, C.warn, "#8b5cf6"];
const METHOD_LABELS: Record<string, string> = {
  STRIPE:        "Stripe",
  PAYPAL:        "PayPal",
  BANK_TRANSFER: "Bonifico",
};

const STATUS_COLORS: Record<string, string> = {
  PAID:      C.ok,
  SENT:      C.info,
  OVERDUE:   "#dc4040",
  DRAFT:     C.fg3,
  CANCELLED: C.fg3,
};
const STATUS_LABELS: Record<string, string> = {
  PAID:      "Pagate",
  SENT:      "Inviate",
  OVERDUE:   "Insolute",
  DRAFT:     "Bozze",
  CANCELLED: "Annullate",
};

const fmtEur = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function fmtAxis(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v}`;
}

const tooltipStyle = {
  borderRadius: "6px",
  border: `1px solid ${C.border}`,
  fontSize: "12px",
  fontFamily: "var(--font-inter-tight, system-ui)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

export interface ChartData {
  revenueTrend:         { period: string; label: string; amount: number }[];
  paymentMethodRevenue: { method: string; amount: number }[];
  invoiceStatus:        { status: string; count: number; amount: number }[];
}

export default function DashboardCharts({ revenueTrend, paymentMethodRevenue, invoiceStatus }: ChartData) {
  const hasRevenue = revenueTrend.some((d) => d.amount > 0);

  const pieData = paymentMethodRevenue.map((d) => ({
    name:  METHOD_LABELS[d.method] ?? d.method,
    value: d.amount,
  }));

  const maxStatus = Math.max(...invoiceStatus.map((s) => s.amount), 1);
  const statusData = [...invoiceStatus]
    .sort((a, b) => b.amount - a.amount)
    .map((d) => ({
      name:  STATUS_LABELS[d.status] ?? d.status,
      value: d.amount,
      count: d.count,
      color: STATUS_COLORS[d.status] ?? C.fg3,
      pct:   (d.amount / maxStatus) * 100,
    }));

  return (
    <div className="space-y-5">
      {/* Area chart — revenue trend */}
      <div className="bg-surface border border-border rounded-[var(--r-lg)] p-5">
        <p className="text-[13px] font-medium text-fg mb-5">Entrate nel periodo</p>
        {!hasRevenue ? (
          <p className="text-[13px] text-fg-3 py-8 text-center">Nessun pagamento nel periodo selezionato</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.info} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C.info} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: C.fg3, fontFamily: "var(--font-geist-mono, monospace)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fontSize: 11, fill: C.fg3, fontFamily: "var(--font-geist-mono, monospace)" }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(v) => [fmtEur(Number(v)), "Incassato"]}
                contentStyle={tooltipStyle}
                cursor={{ stroke: C.border, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={C.info}
                strokeWidth={1.5}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 3, fill: C.info, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Donut + Status bars */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Payment method donut */}
        <div className="bg-surface border border-border rounded-[var(--r-lg)] p-5">
          <p className="text-[13px] font-medium text-fg mb-4">Metodo di Pagamento</p>
          {pieData.length === 0 ? (
            <p className="text-[13px] text-fg-3 py-6 text-center">Nessun dato nel periodo</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  dataKey="value"
                  paddingAngle={3}
                  label={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmtEur(Number(v))}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  iconSize={8}
                  iconType="circle"
                  formatter={(val) => (
                    <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{val}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Invoice status bars */}
        <div className="bg-surface border border-border rounded-[var(--r-lg)] p-5">
          <p className="text-[13px] font-medium text-fg mb-5">Stato Fatture</p>
          {statusData.length === 0 ? (
            <p className="text-[13px] text-fg-3 py-6 text-center">Nessuna fattura nel periodo</p>
          ) : (
            <div className="space-y-4">
              {statusData.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] text-fg-2">{d.name}</span>
                    <div className="text-right">
                      <span className="text-[13px] font-medium text-fg tabular-nums">{fmtEur(d.value)}</span>
                      <span className="font-mono text-[11px] text-fg-3 ml-2">({d.count})</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
