/* Inline sparkline — pure SVG, no dependencies */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    const flat = values.length === 1 ? values[0] : 0;
    const pts = [0, 1].map((i) => ({ x: i === 0 ? 2 : 68, y: flat > 0 ? 10 : 18 }));
    const d = `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;
    return (
      <svg width={70} height={20} viewBox="0 0 70 20" style={{ overflow: "visible" }}>
        <path d={d} stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.5} />
      </svg>
    );
  }

  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;
  const W = 70, H = 20, px = 2, py = 2;

  const pts = values.map((v, i) => ({
    x: px + (i / (values.length - 1)) * (W - 2 * px),
    y: (H - py) - ((v - min) / range) * (H - 2 * py),
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const area = `${line}L${pts[pts.length - 1].x.toFixed(1)},${H}L${pts[0].x.toFixed(1)},${H}Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <path d={area} fill={color} fillOpacity={0.13} />
      <path d={line} stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface KpiCardProps {
  eyebrow:        string;
  value:          string;
  sub?:           string;
  change?:        number | null;
  valueColor?:    string; /* CSS color — defaults to var(--fg) */
  sparklineValues?: number[];
  sparklineColor?:  string; /* CSS color */
}

export function KpiCard({
  eyebrow,
  value,
  sub,
  change,
  valueColor,
  sparklineValues = [],
  sparklineColor,
}: KpiCardProps) {
  const vColor  = valueColor  ?? "var(--fg)";
  const spColor = sparklineColor ?? valueColor ?? "var(--fg-3)";

  return (
    <div
      className="rounded-[8px] p-5 flex flex-col min-h-[120px]"
      style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}
    >
      {/* Row 1: eyebrow + change */}
      <div className="flex items-start justify-between mb-3">
        <p
          className="font-mono text-[10px] uppercase"
          style={{ color: "var(--fg-2)", letterSpacing: "0.12em" }}
        >
          {eyebrow}
        </p>
        {change !== null && change !== undefined && (
          <span
            className="font-mono text-[11px] font-medium"
            style={{ color: change >= 0 ? "var(--ok)" : "var(--danger)" }}
          >
            {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Row 2: value */}
      <p
        className="font-semibold tabular-nums leading-none"
        style={{ fontSize: "27px", letterSpacing: "-0.02em", color: vColor }}
      >
        {value}
      </p>

      {/* Row 3: sub + sparkline */}
      <div className="flex items-end justify-between mt-auto pt-3">
        {sub && (
          <p className="text-[11px] leading-tight" style={{ color: "var(--fg-3)" }}>
            {sub}
          </p>
        )}
        <div className="ml-auto shrink-0">
          <Sparkline values={sparklineValues} color={spColor} />
        </div>
      </div>
    </div>
  );
}
