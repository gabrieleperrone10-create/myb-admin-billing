import Link from "next/link";
import { companyPath } from "@/lib/paths";
import { formatFieldValue, type CustomFieldValue } from "@/lib/crm/customFields";
import type { FormField } from "@/lib/crm/types";
import type { EditorSubmission } from "./formTypes";

export function SubmissionsTab({
  slug,
  fields,
  submissions,
  submissionCount,
}: {
  slug: string;
  fields: FormField[];
  submissions: EditorSubmission[];
  submissionCount: number;
}) {
  if (submissions.length === 0) {
    return <p className="text-[13px] text-fg-3 py-10 text-center">Nessun invio ricevuto finora.</p>;
  }

  const columns = fields.filter(f => f.mapTo === "std:email" || f.mapTo === "std:phone").slice(0, 2);
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-2">
      {submissionCount > submissions.length && (
        <p className="text-[12px] text-fg-3">Mostrati gli ultimi {submissions.length} di {submissionCount} invii.</p>
      )}
      <div className="bg-surface border border-border rounded-[var(--r-lg)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-subtle border-b border-border">
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Data</th>
              <th className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">Contatto</th>
              {columns.map(c => (
                <th key={c.id} className="text-left px-4 py-2 font-mono text-[10px] uppercase tracking-table-head text-fg-3">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map(s => (
              <tr key={s.id} className="border-b border-subtle hover:bg-subtle/60 transition-colors">
                <td className="px-4 py-2.5 text-[12px] text-fg-3 whitespace-nowrap">{dateFmt.format(new Date(s.createdAt))}</td>
                <td className="px-4 py-2.5 text-[13px]">
                  {s.contactId ? (
                    <Link href={companyPath(slug, `/contacts/${s.contactId}`)} className="text-info hover:underline font-medium">
                      {s.contactName ?? "Contatto"}
                    </Link>
                  ) : (
                    <span className="text-fg-3">—</span>
                  )}
                </td>
                {columns.map(c => (
                  <td key={c.id} className="px-4 py-2.5 text-[13px] text-fg-2">
                    {formatFieldValue(c.type, s.data[c.id] as CustomFieldValue) || <span className="text-fg-3">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
