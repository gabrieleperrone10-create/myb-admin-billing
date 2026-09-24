import { FileText } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { formatDate } from "@/lib/utils";
import type { FormField } from "@/lib/crm/types";
import type { ContactTabProps } from "./types";

function valueToText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "boolean") return v ? "Sì" : "No";
  return String(v);
}

/**
 * Tab Form: elenco dei FormSubmission del contatto, con le risposte
 * etichettate usando Form.fields (FormField[] — id -> label) e i campi non
 * mappati mostrati con la chiave grezza. Proprietario: agente B.
 */
export default async function FormsTab({ slug, contactId }: ContactTabProps) {
  const { db } = await requireCompany(slug);

  const submissions = await db.formSubmission.findMany({
    where: { contactId },
    include: { form: true },
    orderBy: { createdAt: "desc" },
  });

  if (submissions.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--fg-3)" }} strokeWidth={1.4} />
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>Nessun form compilato da questo contatto</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {submissions.map(sub => {
        const fields = (Array.isArray(sub.form.fields) ? sub.form.fields : []) as unknown as FormField[];
        const data = (sub.data ?? {}) as Record<string, unknown>;
        const attribution = (sub.attribution ?? null) as Record<string, string> | null;
        const mappedIds = new Set(fields.map(f => f.id));
        const unmapped = Object.keys(data).filter(k => !mappedIds.has(k));

        return (
          <details key={sub.id} className="group rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none">
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{sub.form.name}</p>
                {sub.pageUrl && <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>{sub.pageUrl}</p>}
              </div>
              <span className="text-[12px] shrink-0" style={{ color: "var(--fg-3)" }}>{formatDate(sub.createdAt)}</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="space-y-1.5">
                {fields.map(f => (
                  <div key={f.id} className="flex justify-between gap-3 text-[13px]">
                    <span style={{ color: "var(--fg-3)" }}>{f.label}</span>
                    <span className="text-right" style={{ color: "var(--fg)" }}>{valueToText(data[f.id])}</span>
                  </div>
                ))}
                {unmapped.map(key => (
                  <div key={key} className="flex justify-between gap-3 text-[13px]">
                    <span className="italic" style={{ color: "var(--fg-3)" }}>{key}</span>
                    <span className="text-right" style={{ color: "var(--fg)" }}>{valueToText(data[key])}</span>
                  </div>
                ))}
              </div>
              {attribution && Object.keys(attribution).length > 0 && (
                <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--fg-3)" }}>Attribuzione</p>
                  <div className="space-y-1">
                    {Object.entries(attribution).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 text-[12px]">
                        <span style={{ color: "var(--fg-3)" }}>{k}</span>
                        <span className="text-right truncate max-w-[70%]" style={{ color: "var(--fg)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
