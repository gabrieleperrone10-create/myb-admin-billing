/**
 * Tile KPI dei report, stesso stile di components/ui/KpiCard. Differenza: la
 * freccia indica SEMPRE la direzione reale del valore, il colore dice se e' un
 * bene (`goodWhen`): un CPL che sale mostra ↑ in rosso, non ↓ in verde.
 * Nessuna direttiva: e' un componente senza stato usabile dai Server Component
 * (props solo stringhe/numeri).
 */
export function ReportKpi({
  label,
  value,
  sub,
  delta,
  goodWhen = "up",
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  goodWhen?: "up" | "down" | "neutral";
  muted?: boolean;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const up = hasDelta && delta! > 0;
  const flat = hasDelta && Math.abs(delta!) < 0.5;
  const good = goodWhen === "neutral" || flat ? null : goodWhen === "up" ? up : !up;
  const color = good === null ? "var(--fg-3)" : good ? "var(--ok)" : "var(--danger)";

  return (
    <div
      className="rounded-[var(--r-lg)] p-4 flex flex-col"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", minHeight: 100 }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-mono text-[9px] md:text-[10px] uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>
          {label}
        </p>
        {hasDelta && (
          <span
            className="font-mono text-[10px] font-medium whitespace-nowrap"
            style={{ color }}
            title="Variazione rispetto al periodo precedente"
          >
            {flat ? "=" : up ? "↑" : "↓"} {Math.abs(delta!).toFixed(0)}%
          </span>
        )}
      </div>
      <p
        className="font-bold leading-none"
        style={{ fontSize: "clamp(18px, 3.6vw, 24px)", letterSpacing: "-0.025em", color: muted ? "var(--fg-3)" : "var(--fg)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] leading-tight mt-auto pt-2" style={{ color: "var(--fg-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
