"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { companyPath } from "@/lib/paths";
import type { FormField, FormSettings } from "@/lib/crm/types";
import { saveForm } from "@/app/actions/forms";
import { FieldsEditor } from "./FieldsEditor";
import { SettingsPanel } from "./SettingsPanel";
import { ShareTab } from "./ShareTab";
import { SubmissionsTab } from "./SubmissionsTab";
import type { EditorPipeline, EditorTag, EditorMember, EditorCustomFieldDef, EditorSubmission } from "./formTypes";

type Tab = "fields" | "settings" | "share" | "submissions";

const TABS: { key: Tab; label: string }[] = [
  { key: "fields", label: "Campi" },
  { key: "settings", label: "Impostazioni" },
  { key: "share", label: "Condividi" },
  { key: "submissions", label: "Invii" },
];

export function FormEditor({
  slug,
  formId,
  initialName,
  initialActive,
  initialFields,
  initialSettings,
  pipelines,
  tags,
  members,
  customFieldDefs,
  submissions,
  submissionCount,
  trackingKey,
  origin,
}: {
  slug: string;
  formId: string;
  initialName: string;
  initialActive: boolean;
  initialFields: FormField[];
  initialSettings: FormSettings;
  pipelines: EditorPipeline[];
  tags: EditorTag[];
  members: EditorMember[];
  customFieldDefs: EditorCustomFieldDef[];
  submissions: EditorSubmission[];
  submissionCount: number;
  trackingKey: string;
  origin: string;
}) {
  const [tab, setTab] = useState<Tab>("fields");
  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [settings, setSettings] = useState<FormSettings>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveForm(slug, formId, { name, active, fields, settings });
        if (result.ok) setSavedAt(Date.now());
        else setError(result.error);
      } catch {
        setError("Salvataggio non riuscito, riprova");
      }
    });
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-start gap-3">
        <Link href={companyPath(slug, "/forms")} className="mt-2 text-fg-3 shrink-0" aria-label="Torna ai form">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome del form"
            className="w-full text-[20px] font-semibold text-fg bg-transparent focus:outline-none border-b border-transparent focus:border-border pb-1"
          />
          <label className="inline-flex items-center gap-2 text-[12px] text-fg-2">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
            Form attivo (raggiungibile pubblicamente)
          </label>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && (
            <span className="inline-flex items-center gap-1 text-[12px] text-danger">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </span>
          )}
          {!error && savedAt && !pending && (
            <span className="inline-flex items-center gap-1 text-[12px] text-ok">
              <Check className="w-3.5 h-3.5" /> Salvato
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="px-4 py-2 bg-fg text-white text-[13px] font-semibold rounded-[var(--r-md)] disabled:opacity-50"
          >
            {pending ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="px-3 py-2 text-[13px] whitespace-nowrap -mb-px"
              style={{
                color: on ? "var(--fg)" : "var(--fg-3)",
                borderBottom: on ? "2px solid var(--fg)" : "2px solid transparent",
                fontWeight: on ? 600 : 400,
              }}
            >
              {t.label}
              {t.key === "submissions" && submissionCount > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-subtle text-fg-3">{submissionCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "fields" && (
        <FieldsEditor name={name} fields={fields} settings={settings} onFieldsChange={setFields} customFieldDefs={customFieldDefs} />
      )}
      {tab === "settings" && (
        <SettingsPanel settings={settings} onChange={setSettings} pipelines={pipelines} tags={tags} members={members} />
      )}
      {tab === "share" && (
        <ShareTab origin={origin} formId={formId} trackingKey={trackingKey} active={active} />
      )}
      {tab === "submissions" && (
        <SubmissionsTab slug={slug} fields={fields} submissions={submissions} submissionCount={submissionCount} />
      )}
    </div>
  );
}
