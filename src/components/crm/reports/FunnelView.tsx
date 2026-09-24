import { fmtDays, fmtInt, fmtPct } from "@/lib/crm/reports/format";
import type { FunnelStep } from "@/lib/crm/reports/funnel";

/**
 * Imbuto per fase. Markup statico (nessuna direttiva, nessuna callback):
 * barre orizzontali in HTML, un solo colore (una sola serie), valori sempre
 * scritti accanto alla barra quindi nessun tooltip necessario.
 */
export function FunnelView({
  pipelineName,
  steps,
  total,
  won,
  lost,
  open,
  winRate,
  lostReasons,
}: {
  pipelineName: string;
  steps: FunnelStep[];
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  lostReasons: { reason: string; count: number }[];
}) {
  const max = Math.max(1, ...steps.map(s => s.reached));
  const maxReason = Math.max(1, ...lostReasons.map(r => r.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Opportunità create" value={fmtInt(total)} />
        <Stat label="Vinte" value={fmtInt(won)} />
        <Stat label="Perse" value={fmtInt(lost)} />
        <Stat label="Tasso di vittoria" value={fmtPct(winRate)} sub={`${fmtInt(open)} ancora aperte`} />
      </div>

      <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-[13px] font-medium text-fg">Imbuto · {pipelineName}</p>
        <p className="text-[11px] text-fg-3 mb-4">
          Opportunità create nel periodo che hanno raggiunto ogni fase (o una successiva).
        </p>
        {total === 0 ? (
          <p className="text-[13px] text-fg-3 py-8 text-center">Nessun dato nel periodo</p>
        ) : (
          <div className="space-y-2.5" role="list">
            {steps.map((s, i) => (
              <div key={s.key} role="listitem" className="grid grid-cols-[minmax(90px,160px)_1fr] items-center gap-3">
                <span className="text-[12px] text-fg-2 truncate" title={s.name}>{s.name}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex-1 h-5 rounded-[4px] bg-subtle overflow-hidden">
                    <div
                      className="h-full rounded-r-[4px]"
                      style={{ width: `${(s.reached / max) * 100}%`, minWidth: s.reached > 0 ? 3 : 0, backgroundColor: "var(--rep-s1)" }}
                    />
                  </div>
                  <span className="text-[12px] font-medium text-fg tabular-nums w-10 text-right">{fmtInt(s.reached)}</span>
                  <span className="text-[11px] text-fg-3 tabular-nums w-14 text-right" title="Conversione dalla fase precedente">
                    {i === 0 ? "" : fmtPct(s.stepConversion)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4">
        <div className="rounded-[var(--r-lg)] p-4 md:p-[18px] overflow-x-auto" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-medium text-fg mb-3">Conversione e tempi per fase</p>
          <table className="w-full text-[12px] min-w-[480px]">
            <thead>
              <tr className="text-left text-fg-3">
                <th className="py-1.5 pr-3 font-medium">Fase</th>
                <th className="py-1.5 pr-3 font-medium text-right">Raggiunte</th>
                <th className="py-1.5 pr-3 font-medium text-right">Da fase prec.</th>
                <th className="py-1.5 pr-3 font-medium text-right">Dall&apos;inizio</th>
                <th className="py-1.5 font-medium text-right">Tempo medio in fase</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {steps.map((s, i) => (
                <tr key={s.key} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-fg">
                    <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-fg">{fmtInt(s.reached)}</td>
                  <td className="py-1.5 pr-3 text-right text-fg-2">{i === 0 ? "—" : fmtPct(s.stepConversion)}</td>
                  <td className="py-1.5 pr-3 text-right text-fg-2">{fmtPct(s.totalConversion)}</td>
                  <td className="py-1.5 text-right text-fg-2" title={s.timedCount ? `${s.timedCount} opportunità con permanenza conclusa` : undefined}>
                    {s.kind === "WON" ? "—" : fmtDays(s.avgDays)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-fg-3 mt-3 leading-relaxed">
            Regola: un&apos;opportunità conta per una fase se ha raggiunto quella fase o una successiva (anche saltandola);
            le vinte contano per tutte le fasi, le perse fino all&apos;ultima fase raggiunta. Il tempo in fase è la
            differenza fra due ingressi consecutivi: le permanenze ancora in corso non entrano nella media.
          </p>
        </div>

        <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[13px] font-medium text-fg mb-3">Motivi di perdita</p>
          {lostReasons.length === 0 ? (
            <p className="text-[13px] text-fg-3 py-6 text-center">Nessuna opportunità persa nel periodo</p>
          ) : (
            <ul className="space-y-3">
              {lostReasons.map(r => (
                <li key={r.reason}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <span className="text-[12px] text-fg-2 truncate" title={r.reason}>{r.reason}</span>
                    <span className="text-[12px] font-medium text-fg tabular-nums">{fmtInt(r.count)}</span>
                  </div>
                  <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(r.count / maxReason) * 100}%`, backgroundColor: "var(--rep-s2)" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[var(--r-lg)] p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="font-mono text-[10px] uppercase text-fg-3" style={{ letterSpacing: "0.12em" }}>{label}</p>
      <p className="font-bold mt-2 text-fg" style={{ fontSize: 22, letterSpacing: "-0.025em" }}>{value}</p>
      {sub && <p className="text-[11px] text-fg-3 mt-1">{sub}</p>}
    </div>
  );
}
