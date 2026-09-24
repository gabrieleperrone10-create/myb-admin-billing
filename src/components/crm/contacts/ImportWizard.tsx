"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ContactLifecycle } from "@prisma/client";
import { companyPath } from "@/lib/paths";
import { CONTACT_STANDARD_FIELDS } from "@/lib/crm/types";
import { fieldKeyFromLabel } from "@/lib/crm/customFields";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/FormField";
import { importContactsBatch, type ImportRowResult } from "@/app/actions/contacts";
import type { TagOption, CustomFieldDefLite } from "./types";

// Limite lato client, deve restare allineato a MAX_IMPORT_ROWS in src/app/actions/contacts.ts
// (non importabile: un file "use server" puo' esportare solo funzioni async).
const MAX_IMPORT_ROWS = 5000;
const BATCH_SIZE = 200;
const PREVIEW_ROWS = 8;

type Step = "upload" | "map" | "importing" | "done";
type RawRow = Record<string, string>;
type Mapping = Record<string, string>; // header -> "std:<key>" | "cf:<key>" | "skip"

const LIFECYCLE_OPTIONS: { value: ContactLifecycle; label: string }[] = [
  { value: "LEAD", label: "Lead" },
  { value: "CUSTOMER", label: "Cliente" },
  { value: "ARCHIVED", label: "Archiviato" },
];

export default function ImportWizard({
  slug, tags, customFieldDefs,
}: {
  slug: string;
  tags: TagOption[];
  customFieldDefs: CustomFieldDefLite[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [defaultTagIds, setDefaultTagIds] = useState<string[]>([]);
  const [defaultLifecycle, setDefaultLifecycle] = useState<ContactLifecycle>("LEAD");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportRowResult[]>([]);

  const targetOptions = useMemo(() => [
    { value: "skip", label: "Ignora" },
    ...CONTACT_STANDARD_FIELDS.map(f => ({ value: `std:${f.key}`, label: f.label })),
    ...customFieldDefs.map(d => ({ value: `cf:${d.key}`, label: d.label })),
  ], [customFieldDefs]);

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const { parse } = await import("csv-parse/browser/esm/sync");
      const parsed = parse(text, {
        columns: true,
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
        delimiter: [",", ";"],
      }) as RawRow[];

      if (parsed.length === 0) {
        setParseError("Il file non contiene righe da importare.");
        return;
      }
      if (parsed.length > MAX_IMPORT_ROWS) {
        setParseError(`Il file contiene ${parsed.length} righe: il limite per import è ${MAX_IMPORT_ROWS}. Dividilo in più file.`);
        return;
      }

      const csvHeaders = Object.keys(parsed[0]);
      setHeaders(csvHeaders);
      setRows(parsed);
      setMapping(autoMap(csvHeaders, customFieldDefs));
      setStep("map");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "File non leggibile. Verifica che sia un CSV valido.");
    }
  }

  async function startImport() {
    setStep("importing");
    setProgress({ done: 0, total: rows.length });
    const allResults: ImportRowResult[] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await importContactsBatch(slug, { rows: batch, mapping, defaultTagIds, defaultLifecycle });
      if (res.ok) {
        for (const r of res.results) allResults.push({ ...r, row: r.row + i });
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
    }
    setResults(allResults);
    setStep("done");
  }

  const created = results.filter(r => r.status === "created").length;
  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped");

  return (
    <div className="space-y-5">
      {step === "upload" && (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 rounded-[var(--r-lg)] text-center cursor-pointer"
          style={{ border: "2px dashed var(--border)", backgroundColor: "var(--surface)" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          <Upload className="w-8 h-8" style={{ color: "var(--fg-3)" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--fg)" }}>Trascina un file CSV qui, o clicca per scegliere</p>
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Separatore virgola o punto e virgola — fino a {MAX_IMPORT_ROWS} righe</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {parseError && (
            <p className="flex items-center gap-1.5 text-[12px] mt-2" style={{ color: "var(--danger)" }}>
              <AlertCircle className="w-3.5 h-3.5" /> {parseError}
            </p>
          )}
        </div>
      )}

      {step === "map" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
            <FileText className="w-4 h-4" style={{ color: "var(--fg-3)" }} />
            {fileName} — {rows.length} righe trovate
          </div>

          <div className="space-y-2">
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Mappatura colonne</h2>
            <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {headers.map((h, i) => (
                <div key={h} className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: i < headers.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: "var(--surface)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{h}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>
                      es. {rows.slice(0, 3).map(r => r[h]).filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <select
                    value={mapping[h] ?? "skip"}
                    onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                    className="w-[220px] px-2 py-1.5 rounded-[6px] text-[12px] shrink-0"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
                  >
                    {targetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Anteprima</h2>
            <div className="overflow-x-auto rounded-[var(--r-lg)]" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ backgroundColor: "var(--subtle)" }}>
                    {headers.map(h => <th key={h} className="text-left px-2.5 py-1.5 font-mono uppercase text-[10px]" style={{ color: "var(--fg-3)" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      {headers.map(h => <td key={h} className="px-2.5 py-1.5 truncate max-w-[160px]" style={{ color: "var(--fg-2)" }}>{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>Etichette da applicare a tutti</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <button
                    key={t.id} type="button"
                    onClick={() => setDefaultTagIds(ids => ids.includes(t.id) ? ids.filter(x => x !== t.id) : [...ids, t.id])}
                    className="text-[12px] px-2.5 py-1 rounded-full border"
                    style={{
                      backgroundColor: defaultTagIds.includes(t.id) ? `${t.color}26` : "transparent",
                      borderColor: defaultTagIds.includes(t.id) ? t.color : "var(--border)",
                      color: defaultTagIds.includes(t.id) ? t.color : "var(--fg-2)",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                {tags.length === 0 && <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Nessuna etichetta creata</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Select
                label="Ciclo di vita di default"
                value={defaultLifecycle}
                onChange={e => setDefaultLifecycle(e.target.value as ContactLifecycle)}
                options={LIFECYCLE_OPTIONS}
              />
              <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>Applicato ai contatti nuovi; quelli già esistenti mantengono/aggiornano il proprio stato</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setStep("upload")}>Indietro</Button>
            <Button icon={<ArrowRight className="w-3.5 h-3.5" />} onClick={startImport}>Importa {rows.length} contatti</Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--fg-3)" }} />
          <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>Importazione in corso… {progress.done} / {progress.total}</p>
          <div className="w-[280px] h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--subtle)" }}>
            <div className="h-full" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, backgroundColor: "var(--fg)" }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 p-4 rounded-[var(--r-lg)]" style={{ backgroundColor: "var(--ok-soft)", border: "1px solid var(--ok)" }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--ok)" }} />
            <p className="text-[13px]" style={{ color: "var(--fg)" }}>
              Importazione completata: <strong>{created}</strong> creati, <strong>{updated}</strong> aggiornati, <strong>{skipped.length}</strong> scartati.
            </p>
          </div>

          {skipped.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Righe scartate</h2>
              <div className="rounded-[var(--r-lg)] overflow-hidden max-h-[300px] overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                {skipped.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ borderBottom: i < skipped.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span className="font-mono" style={{ color: "var(--fg-3)" }}>Riga {r.row + 1}</span>
                    <span style={{ color: "var(--fg-2)" }}>{r.reason ?? "Scartata"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={() => router.push(companyPath(slug, "/contacts"))}>Vai ai contatti</Button>
            <Button variant="secondary" onClick={() => { setStep("upload"); setRows([]); setHeaders([]); setResults([]); setFileName(""); }}>
              Importa un altro file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Auto-match colonna CSV -> campo standard/personalizzato in base al nome normalizzato. */
function autoMap(headers: string[], customFieldDefs: CustomFieldDefLite[]): Mapping {
  const mapping: Mapping = {};
  const stdByKey = new Map(CONTACT_STANDARD_FIELDS.map(f => [fieldKeyFromLabel(f.label), `std:${f.key}`] as const));
  for (const f of CONTACT_STANDARD_FIELDS) stdByKey.set(f.key, `std:${f.key}`);
  const cfByKey = new Map<string, string>();
  for (const d of customFieldDefs) {
    cfByKey.set(d.key, `cf:${d.key}`);
    cfByKey.set(fieldKeyFromLabel(d.label), `cf:${d.key}`);
  }
  for (const h of headers) {
    const norm = fieldKeyFromLabel(h);
    mapping[h] = stdByKey.get(norm) ?? cfByKey.get(norm) ?? "skip";
  }
  return mapping;
}
