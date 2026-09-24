"use client";

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import type { FormField, FormSettings } from "@/lib/crm/types";
import { stdKeyOf, cfKeyOf } from "@/lib/crm/forms/shared";
import { FieldRow } from "./FieldRow";
import { FormPreview } from "./FormPreview";
import type { EditorCustomFieldDef } from "./formTypes";

function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

export function FieldsEditor({
  name,
  fields,
  settings,
  onFieldsChange,
  customFieldDefs,
}: {
  name: string;
  fields: FormField[];
  settings: FormSettings;
  onFieldsChange: (fields: FormField[]) => void;
  customFieldDefs: EditorCustomFieldDef[];
}) {
  const usedStdKeys = new Set(fields.map(f => stdKeyOf(f.mapTo)).filter((k): k is string => !!k));
  const usedCfKeys = new Set(fields.map(f => cfKeyOf(f.mapTo)).filter((k): k is string => !!k));

  function addField() {
    onFieldsChange([...fields, { id: newFieldId(), label: "", type: "TEXT", mapTo: null, required: false }]);
  }

  function updateField(index: number, next: FormField) {
    const copy = fields.slice();
    copy[index] = next;
    onFieldsChange(copy);
  }

  function removeField(index: number) {
    onFieldsChange(fields.filter((_, i) => i !== index));
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const copy = fields.slice();
    const [moved] = copy.splice(result.source.index, 1);
    copy.splice(result.destination.index, 0, moved);
    onFieldsChange(copy);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
      <div className="space-y-3">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="form-fields">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2.5">
                {fields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(dragProvided) => (
                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                        <FieldRow
                          field={field}
                          onChange={next => updateField(index, next)}
                          onRemove={() => removeField(index)}
                          dragHandleProps={dragProvided.dragHandleProps}
                          usedStdKeys={usedStdKeys}
                          usedCfKeys={usedCfKeys}
                          customFieldDefs={customFieldDefs}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <button
          type="button"
          onClick={addField}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-border rounded-[var(--r-md)] text-[13px] font-medium text-fg-2 hover:bg-subtle transition-colors"
        >
          <Plus className="w-4 h-4" /> Aggiungi campo
        </button>
      </div>

      <div className="lg:sticky lg:top-4">
        <FormPreview name={name} fields={fields} settings={settings} />
      </div>
    </div>
  );
}
