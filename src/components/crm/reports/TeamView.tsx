import { fmtDays, fmtEur, fmtInt, fmtPct } from "@/lib/crm/reports/format";

export type TeamRowView = {
  key: string;
  name: string;
  leads: number;
  won: number;
  lost: number;
  wonValue: number;
  winRate: number | null;
  appointmentsCompleted: number;
  appointmentsNoShow: number;
  showRate: number | null;
  avgDaysToClose: number | null;
};

/** Tabella del team (markup statico, props solo dati). */
export function TeamView({ rows }: { rows: TeamRowView[] }) {
  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[13px] font-medium text-fg">Risultati per responsabile</p>
      <p className="text-[11px] text-fg-3 mb-3">
        Lead assegnati = contatti creati nel periodo con quel responsabile · vinte/perse = opportunità chiuse nel periodo ·
        appuntamenti con inizio nel periodo, per host · tempo di chiusura = dalla creazione alla vittoria.
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-fg-3 py-10 text-center">Nessun dato nel periodo</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[820px]">
            <thead>
              <tr className="text-fg-3 border-b border-border">
                <th className="py-2 pr-3 font-medium text-left">Responsabile</th>
                <th className="py-2 px-2 font-medium text-right">Lead</th>
                <th className="py-2 px-2 font-medium text-right">Vinte</th>
                <th className="py-2 px-2 font-medium text-right">Perse</th>
                <th className="py-2 px-2 font-medium text-right">Valore vinto</th>
                <th className="py-2 px-2 font-medium text-right">Tasso vittoria</th>
                <th className="py-2 px-2 font-medium text-right">App. svolti</th>
                <th className="py-2 px-2 font-medium text-right">No-show</th>
                <th className="py-2 px-2 font-medium text-right">Show rate</th>
                <th className="py-2 pl-2 font-medium text-right">Tempo chiusura</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border">
                  <td className="py-2 pr-3 text-fg font-medium">{r.name}</td>
                  <td className="py-2 px-2 text-right text-fg">{fmtInt(r.leads)}</td>
                  <td className="py-2 px-2 text-right text-fg">{fmtInt(r.won)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtInt(r.lost)}</td>
                  <td className="py-2 px-2 text-right text-fg">{fmtEur(r.wonValue)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtPct(r.winRate)}</td>
                  <td className="py-2 px-2 text-right text-fg">{fmtInt(r.appointmentsCompleted)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtInt(r.appointmentsNoShow)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtPct(r.showRate)}</td>
                  <td className="py-2 pl-2 text-right text-fg-2">{fmtDays(r.avgDaysToClose)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
