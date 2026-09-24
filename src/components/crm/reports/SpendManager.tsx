"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Upload, Plus, X } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { Button } from "@/components/ui/Button";
import { fmtEur } from "@/lib/crm/reports/format";
import { formatDay } from "@/lib/crm/reports/period";
import { createAdSpend, deleteAdSpend, importAdSpendCsv, updateAdSpend } from "@/app/actions/adSpend";

export type SpendRowData = {
  id: string;
  source: string;
  sourceLabel: string;
  campaign: string | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  notes: string | null;
};

type FormState = { source: string; campaign: string; periodStart: string; periodEnd: string; amount: string; notes: string };

const EMPTY: FormState = { source: "", campaign: "", periodStart: "", periodEnd: "", amount: "", notes: "" };

const input =
  "w-full border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[13px] text-fg bg-surface focus:outline-none focus:border-info";

export function SpendManager({
  rows,
  canEdit,
  sourceSuggestions,
  defaultStart,
  defaultEnd,
}: {
  rows: SpendRowData[];
  canEdit: boolean;
  sourceSuggestions: string[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const slug = useCompanySlug();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [csvErrors, setCsvErrors] = useState<{ line: number; message: string }[]>([]);
  const [csvValid, setCsvValid] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function openNew() {
    setEditingId(null);
    setError(null);
    setForm({ ...EMPTY, periodStart: defaultStart, periodEnd: defaultEnd });
  }

  function openEdit(r: SpendRowData) {
    setEditingId(r.id);
    setError(null);
    setForm({
      source: r.source, campaign: r.campaign ?? "", periodStart: r.periodStart, periodEnd: r.periodEnd,
      amount: String(r.amount).replace(".", ","), notes: r.notes ?? "",
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    startTransition(async () => {
      const payload = { ...form, campaign: form.campaign || null, notes: form.notes || null };
      const res = editingId ? await updateAdSpend(slug, editingId, payload) : await createAdSpend(slug, payload);
      if (!res.ok) { setError(res.error); return; }
      setForm(null);
      setEditingId(null);
      setNotice(editingId ? "Spesa aggiornata" : "Spesa aggiunta");
      router.refresh();
    });
  }

  function remove(r: SpendRowData) {
    if (!window.confirm(`Eliminare la spesa ${r.sourceLabel}${r.campaign ? ` · ${r.campaign}` : ""} di ${fmtEur(r.amount)}?`)) return;
    startTransition(async () => {
      const res = await deleteAdSpend(slug, r.id);
      if (!res.ok) { setError(res.error); return; }
      setNotice("Spesa eliminata");
      router.refresh();
    });
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2_000_000) { setError("File troppo grande (max 2 MB)"); return; }
    const text = await f.text();
    setCsv({ name: f.name, text });
    runImport(text, false);
  }

  function runImport(text: string, skipInvalid: boolean) {
    setError(null);
    setNotice(null);
    setCsvErrors([]);
    startTransition(async () => {
      const res = await importAdSpendCsv(slug, text, skipInvalid);
      if (res.ok) {
        setCsv(null);
        setCsvErrors(res.errors);
        setNotice(`${res.imported} righe importate${res.errors.length ? `, ${res.errors.length} scartate` : ""}`);
        router.refresh();
      } else {
        setError(res.error);
        setCsvErrors(res.errors);
        setCsvValid(res.validRows);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openNew} disabled={pending}>Aggiungi spesa</Button>
          <Button size="sm" variant="secondary" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => fileRef.current?.click()} loading={pending && !!csv}>
            Importa CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pickFile} />
          <span className="text-[11px] text-fg-3">
            Colonne: data inizio, data fine, fonte, campagna, importo · separatore «,» o «;» · importi anche con virgola decimale
          </span>
        </div>
      )}

      {notice && (
        <p className="text-[12px] px-3 py-2 rounded-[var(--r-md)]" style={{ backgroundColor: "var(--ok-soft)", color: "var(--ok)" }}>{notice}</p>
      )}
      {error && (
        <div className="text-[12px] px-3 py-2 rounded-[var(--r-md)] space-y-1" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
          <p className="font-medium">{error}</p>
          {csvErrors.length > 0 && (
            <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
              {csvErrors.slice(0, 50).map((e, i) => <li key={i}>{e.line > 0 ? `Riga ${e.line}: ` : ""}{e.message}</li>)}
            </ul>
          )}
          {csv && csvValid > 0 && (
            <button type="button" className="underline font-medium" onClick={() => runImport(csv.text, true)} disabled={pending}>
              Importa comunque le {csvValid} righe valide di {csv.name}
            </button>
          )}
        </div>
      )}

      {form && canEdit && (
        <form onSubmit={save} className="rounded-[var(--r-lg)] p-4 space-y-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-fg">{editingId ? "Modifica spesa" : "Nuova spesa"}</p>
            <button type="button" onClick={() => setForm(null)} className="text-fg-3 hover:text-fg" aria-label="Chiudi"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-[12px] text-fg-2 space-y-1">
              <span>Fonte *</span>
              <input className={input} list="rep-sources" value={form.source} required placeholder="es. meta, google"
                onChange={e => setForm({ ...form, source: e.target.value })} />
              <datalist id="rep-sources">{sourceSuggestions.map(s => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="text-[12px] text-fg-2 space-y-1">
              <span>Campagna</span>
              <input className={input} value={form.campaign} placeholder="come in utm_campaign"
                onChange={e => setForm({ ...form, campaign: e.target.value })} />
            </label>
            <label className="text-[12px] text-fg-2 space-y-1">
              <span>Dal *</span>
              <input type="date" className={input} value={form.periodStart} required
                onChange={e => setForm({ ...form, periodStart: e.target.value })} />
            </label>
            <label className="text-[12px] text-fg-2 space-y-1">
              <span>Al *</span>
              <input type="date" className={input} value={form.periodEnd} required min={form.periodStart || undefined}
                onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
            </label>
            <label className="text-[12px] text-fg-2 space-y-1">
              <span>Importo (€) *</span>
              <input className={input} inputMode="decimal" value={form.amount} required placeholder="0,00"
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </label>
          </div>
          <label className="block text-[12px] text-fg-2 space-y-1">
            <span>Note</span>
            <input className={input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </label>
          <p className="text-[11px] text-fg-3">
            La fonte viene normalizzata (fb, facebook, instagram, ig → meta). Lascia vuota la campagna per una spesa
            del canale non attribuita a una campagna precisa.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>{editingId ? "Salva" : "Aggiungi"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>Annulla</Button>
          </div>
        </form>
      )}

      <div className="rounded-[var(--r-lg)] p-4 md:p-[18px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[13px] font-medium text-fg">Voci di spesa</p>
          <p className="text-[12px] text-fg-3">{rows.length} voci · totale <span className="font-medium text-fg">{fmtEur(total)}</span></p>
        </div>
        {rows.length === 0 ? (
          <p className="text-[13px] text-fg-3 py-10 text-center">Nessuna spesa registrata nel periodo</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[640px]">
              <thead>
                <tr className="text-left text-fg-3 border-b border-border">
                  <th className="py-2 pr-3 font-medium">Periodo</th>
                  <th className="py-2 pr-3 font-medium">Fonte</th>
                  <th className="py-2 pr-3 font-medium">Campagna</th>
                  <th className="py-2 pr-3 font-medium text-right">Importo</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  {canEdit && <th className="py-2 w-16" />}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pr-3 text-fg-2 whitespace-nowrap">
                      {r.periodStart === r.periodEnd ? formatDay(r.periodStart) : `${formatDay(r.periodStart)} – ${formatDay(r.periodEnd)}`}
                    </td>
                    <td className="py-2 pr-3 text-fg">{r.sourceLabel}</td>
                    <td className="py-2 pr-3 text-fg-2">{r.campaign ?? <span className="text-fg-3">—</span>}</td>
                    <td className="py-2 pr-3 text-right text-fg tabular-nums">{fmtEur(r.amount)}</td>
                    <td className="py-2 pr-3 text-fg-3 max-w-[200px] truncate" title={r.notes ?? undefined}>{r.notes ?? ""}</td>
                    {canEdit && (
                      <td className="py-2 text-right whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(r)} className="p-1 text-fg-3 hover:text-fg" aria-label="Modifica"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => remove(r)} className="p-1 text-fg-3 hover:text-danger" aria-label="Elimina" disabled={pending}><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
