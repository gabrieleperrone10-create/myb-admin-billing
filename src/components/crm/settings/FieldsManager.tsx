"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronUp, ChevronDown, Trash2, Pencil, X, Info } from "lucide-react";
import type { CustomFieldEntity, CustomFieldType } from "@prisma/client";
import { CUSTOM_FIELD_TYPE_LABEL } from "@/lib/crm/customFields";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import {
  createCustomFieldDef, updateCustomFieldDef, deleteCustomFieldDef, reorderCustomFieldDefs,
} from "@/app/actions/crmSettings";
import type { CustomFieldDefLite } from "@/components/crm/contacts/types";

const TYPE_OPTIONS = (Object.keys(CUSTOM_FIELD_TYPE_LABEL) as CustomFieldType[]).map(t => ({ value: t, label: CUSTOM_FIELD_TYPE_LABEL[t] }));
const NEEDS_OPTIONS: CustomFieldType[] = ["SELECT", "MULTISELECT"];

export default function FieldsManager({
  slug, contactFields, opportunityFields,
}: {
  slug: string;
  contactFields: CustomFieldDefLite[];
  opportunityFields: CustomFieldDefLite[];
}) {
  return (
    <div className="space-y-10">
      <FieldsSection slug={slug} entity="CONTACT" title="Campi contatto" fields={contactFields} />
      <FieldsSection slug={slug} entity="OPPORTUNITY" title="Campi opportunità" fields={opportunityFields} />
    </div>
  );
}

function FieldsSection({
  slug, entity, title, fields,
}: {
  slug: string;
  entity: CustomFieldEntity;
  title: string;
  fields: CustomFieldDefLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const ordered = [...fields];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    startTransition(async () => {
      await reorderCustomFieldDefs(slug, entity, ordered.map(f => f.id));
      refresh();
    });
  }

  function remove(field: CustomFieldDefLite) {
    if (!confirm(`Eliminare il campo "${field.label}"? I valori già salvati sui record esistenti non vengono cancellati, ma spariscono dalla scheda perché non c'è più una definizione per mostrarli.`)) return;
    startTransition(async () => {
      await deleteCustomFieldDef(slug, field.id);
      refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>{title}</h2>
        {!creating && (
          <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)}>Aggiungi campo</Button>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[12px]" style={{ color: "var(--fg-3)" }}>
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Eliminare un campo non cancella i valori già salvati sui record: restano nel database ma non vengono più mostrati, perché senza la definizione nessuna pagina sa più come visualizzarli.
      </p>

      {creating && (
        <FieldForm
          slug={slug}
          entity={entity}
          pending={pending}
          startTransition={startTransition}
          onDone={() => { setCreating(false); refresh(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {fields.length === 0 && !creating && (
        <p className="text-[13px] py-4" style={{ color: "var(--fg-3)" }}>Nessun campo personalizzato ancora.</p>
      )}

      {fields.length > 0 && (
        <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {fields.map((f, i) => (
            <div key={f.id}>
              {editingId === f.id ? (
                <div className="p-3" style={{ borderBottom: i < fields.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: "var(--subtle)" }}>
                  <FieldForm
                    slug={slug}
                    entity={entity}
                    editing={f}
                    pending={pending}
                    startTransition={startTransition}
                    onDone={() => { setEditingId(null); refresh(); }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: i < fields.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: "var(--surface)" }}
                >
                  <div className="flex flex-col shrink-0">
                    <button type="button" disabled={i === 0 || pending} onClick={() => move(i, -1)} style={{ color: "var(--fg-3)" }} className="disabled:opacity-30">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={i === fields.length - 1 || pending} onClick={() => move(i, 1)} style={{ color: "var(--fg-3)" }} className="disabled:opacity-30">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                      {f.label}
                      {f.required && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "var(--danger)" }}>obbligatorio</span>}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: "var(--fg-3)" }}>
                      {f.key} · {CUSTOM_FIELD_TYPE_LABEL[f.type]}
                      {f.options.length > 0 && ` · ${f.options.join(", ")}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditingId(f.id)} className="p-1.5" style={{ color: "var(--fg-3)" }} aria-label="Modifica">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(f)} disabled={pending} className="p-1.5" style={{ color: "var(--danger)" }} aria-label="Elimina">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FieldForm({
  slug, entity, editing, pending, startTransition, onDone, onCancel,
}: {
  slug: string;
  entity: CustomFieldEntity;
  editing?: CustomFieldDefLite;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [type, setType] = useState<CustomFieldType>(editing?.type ?? "TEXT");
  const [required, setRequired] = useState(editing?.required ?? false);
  const [optionsText, setOptionsText] = useState(editing?.options.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);

  const needsOptions = NEEDS_OPTIONS.includes(type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError("Il nome del campo è obbligatorio."); return; }
    const options = optionsText.split(",").map(o => o.trim()).filter(Boolean);
    if (needsOptions && options.length === 0) { setError("Aggiungi almeno un'opzione."); return; }

    startTransition(async () => {
      const res = editing
        ? await updateCustomFieldDef(slug, editing.id, { label: label.trim(), options: needsOptions ? options : undefined, required })
        : await createCustomFieldDef(slug, { entity, label: label.trim(), type, options: needsOptions ? options : undefined, required });
      if (!res.ok) { setError(res.error); return; }
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Nome campo" value={label} onChange={e => setLabel(e.target.value)} required />
        <div className="space-y-1">
          <Select
            label="Tipo"
            value={type}
            onChange={e => setType(e.target.value as CustomFieldType)}
            options={TYPE_OPTIONS}
            disabled={!!editing}
          />
          {editing && <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>Il tipo non è modificabile dopo la creazione</p>}
        </div>
      </div>
      {needsOptions && (
        <Textarea
          label="Opzioni (separate da virgola)"
          value={optionsText}
          onChange={e => setOptionsText(e.target.value)}
          placeholder="Opzione A, Opzione B, Opzione C"
        />
      )}
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
        <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
        Campo obbligatorio
      </label>
      {error && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>{editing ? "Salva" : "Aggiungi"}</Button>
        <Button type="button" size="sm" variant="secondary" icon={<X className="w-3.5 h-3.5" />} onClick={onCancel}>Annulla</Button>
      </div>
    </form>
  );
}
