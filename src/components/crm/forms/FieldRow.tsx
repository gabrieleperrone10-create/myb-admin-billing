"use client";

import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical, Trash2 } from "lucide-react";
import type { CustomFieldType } from "@prisma/client";
import type { FormField } from "@/lib/crm/types";
import { CONTACT_STANDARD_FIELDS } from "@/lib/crm/types";
import { CUSTOM_FIELD_TYPE_LABEL } from "@/lib/crm/customFields";
import type { EditorCustomFieldDef } from "./formTypes";

const FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABEL) as CustomFieldType[];

export function FieldRow({
  field,
  onChange,
  onRemove,
  dragHandleProps,
  usedStdKeys,
  usedCfKeys,
  customFieldDefs,
}: {
  field: FormField;
  onChange: (next: FormField) => void;
  onRemove: () => void;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  usedStdKeys: Set<string>;
  usedCfKeys: Set<string>;
  customFieldDefs: EditorCustomFieldDef[];
}) {
  const isStd = field.mapTo?.startsWith("std:") ?? false;
  const isCf = field.mapTo?.startsWith("cf:") ?? false;
  const typeLocked = isStd || isCf;
  const currentCfDef = isCf ? customFieldDefs.find(d => `cf:${d.key}` === field.mapTo) : undefined;

  function handleMapToChange(value: string) {
    if (value.startsWith("std:")) {
      const key = value.slice(4);
      const std = CONTACT_STANDARD_FIELDS.find(s => s.key === key);
      onChange({ ...field, mapTo: value, type: std?.type ?? field.type, options: undefined });
    } else if (value.startsWith("cf:")) {
      const key = value.slice(3);
      const def = customFieldDefs.find(d => d.key === key);
      onChange({ ...field, mapTo: value, type: def?.type ?? field.type, options: def?.options ? [...def.options] : undefined });
    } else {
      onChange({ ...field, mapTo: null });
    }
  }

  return (
    <div className="bg-surface border border-border rounded-[var(--r-md)] p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...dragHandleProps}
          className="mt-2 text-fg-3 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Trascina per riordinare"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-fg-3">Etichetta</span>
            <input
              value={field.label}
              onChange={e => onChange({ ...field, label: e.target.value })}
              placeholder="Es. Nome e cognome"
              className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg focus:outline-none focus:ring-2 focus:ring-info-soft"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-fg-3">Collegato a</span>
            <select
              value={field.mapTo ?? ""}
              onChange={e => handleMapToChange(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg"
            >
              <option value="">Nessuno (solo nella risposta)</option>
              <optgroup label="Campo standard del contatto">
                {CONTACT_STANDARD_FIELDS.map(s => (
                  <option key={s.key} value={`std:${s.key}`} disabled={usedStdKeys.has(s.key) && field.mapTo !== `std:${s.key}`}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
              {customFieldDefs.length > 0 && (
                <optgroup label="Campo personalizzato">
                  {customFieldDefs.map(d => (
                    <option key={d.key} value={`cf:${d.key}`} disabled={usedCfKeys.has(d.key) && field.mapTo !== `cf:${d.key}`}>
                      {d.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-fg-3">Tipo</span>
            <select
              value={field.type}
              disabled={typeLocked}
              onChange={e => onChange({ ...field, type: e.target.value as CustomFieldType })}
              className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg disabled:bg-subtle disabled:text-fg-3"
            >
              {FIELD_TYPES.map(t => <option key={t} value={t}>{CUSTOM_FIELD_TYPE_LABEL[t]}</option>)}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-fg-3">Segnaposto</span>
            <input
              value={field.placeholder ?? ""}
              onChange={e => onChange({ ...field, placeholder: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg"
            />
          </label>

          <label className="block space-y-1 sm:col-span-2">
            <span className="text-[11px] font-medium text-fg-3">Testo di aiuto</span>
            <input
              value={field.helpText ?? ""}
              onChange={e => onChange({ ...field, helpText: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg"
            />
          </label>

          {(field.type === "SELECT" || field.type === "MULTISELECT") && (
            <div className="sm:col-span-2 space-y-1">
              <span className="text-[11px] font-medium text-fg-3">Opzioni (una per riga)</span>
              {isCf ? (
                <p className="text-[12px] text-fg-3 px-2.5 py-1.5 bg-subtle rounded-[var(--r-sm,6px)]">
                  {currentCfDef?.options?.join(", ") || "—"} <span className="text-[11px]">(definite nel campo personalizzato)</span>
                </p>
              ) : (
                <textarea
                  value={(field.options ?? []).join("\n")}
                  onChange={e => onChange({ ...field, options: e.target.value.split("\n") })}
                  rows={3}
                  className="w-full px-2.5 py-1.5 border border-border rounded-[var(--r-sm,6px)] text-[13px] text-fg bg-bg resize-none"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button type="button" onClick={onRemove} className="text-fg-3 hover:text-danger" aria-label="Rimuovi campo">
            <Trash2 className="w-4 h-4" />
          </button>
          <label className="flex items-center gap-1.5 text-[11px] text-fg-3 whitespace-nowrap">
            <input type="checkbox" checked={field.required} onChange={e => onChange({ ...field, required: e.target.checked })} />
            Obbligatorio
          </label>
        </div>
      </div>
    </div>
  );
}
