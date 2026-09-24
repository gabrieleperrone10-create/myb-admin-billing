import type { FormField, FormSettings } from "@/lib/crm/types";

/**
 * Anteprima statica (non interattiva) del form, usata nell'editor. Il
 * rendering interattivo reale e' in PublicForm.tsx, usato dalla pagina
 * pubblica /f/[formId] — qui basta dare un'idea fedele di come apparira'.
 */
export function FormPreview({ name, fields, settings }: { name: string; fields: FormField[]; settings: FormSettings }) {
  const color = settings.theme?.primaryColor || "#4f7deb";

  return (
    <div className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4">
      <p className="text-[16px] font-semibold text-fg">{name || "Nuovo form"}</p>

      {fields.length === 0 ? (
        <p className="text-[12px] text-fg-3 py-6 text-center">Aggiungi campi per vedere l&apos;anteprima</p>
      ) : (
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.id} className="space-y-1 pointer-events-none">
              <label className="block text-[12px] font-medium text-fg-2">
                {f.label || "Campo senza etichetta"}
                {f.required && <span className="text-danger ml-0.5">*</span>}
              </label>
              <PreviewInput field={f} />
              {f.helpText && <p className="text-[11px] text-fg-3">{f.helpText}</p>}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled
        className="w-full py-2.5 rounded-[var(--r-md)] text-[13px] font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {settings.submitLabel || "Invia"}
      </button>
    </div>
  );
}

function PreviewInput({ field }: { field: FormField }) {
  const base = "w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] bg-bg text-fg-3";
  switch (field.type) {
    case "TEXTAREA":
      return <textarea disabled rows={3} placeholder={field.placeholder} className={base} />;
    case "SELECT":
      return (
        <select disabled className={base}>
          <option>{field.placeholder || "Seleziona…"}</option>
          {(field.options ?? []).map(o => <option key={o}>{o}</option>)}
        </select>
      );
    case "MULTISELECT":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).length === 0
            ? <span className="text-[11px] text-fg-3">Nessuna opzione</span>
            : (field.options ?? []).map(o => (
              <span key={o} className="text-[11px] px-2 py-1 rounded-full border border-border text-fg-3">{o}</span>
            ))}
        </div>
      );
    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 text-[12px] text-fg-3">
          <input type="checkbox" disabled /> {field.placeholder || "Sì"}
        </label>
      );
    default:
      return <input disabled placeholder={field.placeholder} className={base} />;
  }
}
