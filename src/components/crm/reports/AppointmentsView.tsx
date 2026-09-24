import { fmtInt, fmtPct } from "@/lib/crm/reports/format";
import type { AppointmentCounts } from "@/lib/crm/reports/queries";
import { ReportKpi } from "./ReportKpi";

export type AppointmentRowView = AppointmentCounts & { key: string; name: string; color?: string };

/** Appuntamenti per calendario e per host (markup statico, props solo dati). */
export function AppointmentsView({
  totals,
  byCalendar,
  byHost,
}: {
  totals: AppointmentCounts;
  byCalendar: AppointmentRowView[];
  byHost: AppointmentRowView[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <ReportKpi label="Prenotati" value={fmtInt(totals.booked)} sub="Con inizio nel periodo" muted={totals.booked === 0} />
        <ReportKpi label="Svolti" value={fmtInt(totals.completed)} muted={totals.completed === 0} />
        <ReportKpi label="No-show" value={fmtInt(totals.noShow)} muted={totals.noShow === 0} />
        <ReportKpi label="Annullati" value={fmtInt(totals.cancelled)} muted={totals.cancelled === 0} />
        <ReportKpi label="Show rate" value={fmtPct(totals.showRate)} sub="Svolti / (svolti + no-show)" muted={totals.showRate === null} />
        <ReportKpi
          label="Esito da registrare"
          value={fmtInt(totals.pending)}
          sub={`${fmtInt(totals.upcoming)} ancora da svolgere`}
          muted={totals.pending === 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CountsTable title="Per calendario" firstCol="Calendario" rows={byCalendar} />
        <CountsTable title="Per host" firstCol="Host" rows={byHost} />
      </div>
      <p className="text-[11px] text-fg-3">
        Gli appuntamenti passati ancora «programmati» o «confermati» sono esclusi dallo show rate finché non se ne registra
        l&apos;esito (svolto o no-show) dalla scheda appuntamento.
      </p>
    </div>
  );
}

function CountsTable({ title, firstCol, rows }: { title: string; firstCol: string; rows: AppointmentRowView[] }) {
  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-[13px] font-medium text-fg mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-fg-3 py-8 text-center">Nessun dato nel periodo</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[520px]">
            <thead>
              <tr className="text-fg-3 border-b border-border">
                <th className="py-2 pr-3 font-medium text-left">{firstCol}</th>
                <th className="py-2 px-2 font-medium text-right">Prenotati</th>
                <th className="py-2 px-2 font-medium text-right">Svolti</th>
                <th className="py-2 px-2 font-medium text-right">No-show</th>
                <th className="py-2 px-2 font-medium text-right">Annullati</th>
                <th className="py-2 pl-2 font-medium text-right">Show rate</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map(r => (
                <tr key={r.key} className="border-b border-border">
                  <td className="py-2 pr-3 text-fg">
                    {r.color && <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: r.color }} />}
                    {r.name}
                  </td>
                  <td className="py-2 px-2 text-right text-fg">{fmtInt(r.booked)}</td>
                  <td className="py-2 px-2 text-right text-fg">{fmtInt(r.completed)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtInt(r.noShow)}</td>
                  <td className="py-2 px-2 text-right text-fg-2">{fmtInt(r.cancelled)}</td>
                  <td className="py-2 pl-2 text-right text-fg-2">{fmtPct(r.showRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
