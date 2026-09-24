"use client";

import type { FormSettings } from "@/lib/crm/types";
import type { EditorPipeline, EditorTag, EditorMember } from "./formTypes";

export function SettingsPanel({
  settings,
  onChange,
  pipelines,
  tags,
  members,
}: {
  settings: FormSettings;
  onChange: (next: FormSettings) => void;
  pipelines: EditorPipeline[];
  tags: EditorTag[];
  members: EditorMember[];
}) {
  const selectedPipeline = pipelines.find(p => p.id === settings.pipelineId);
  const afterSubmit: "message" | "redirect" = settings.redirectUrl ? "redirect" : "message";

  function set<K extends keyof FormSettings>(key: K, value: FormSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  function toggleTag(tagId: string) {
    const current = settings.tagIds ?? [];
    set("tagIds", current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId]);
  }

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-fg">Bottone e conferma</h3>
        <label className="block space-y-1">
          <span className="text-[12px] font-medium text-fg-2">Testo del bottone</span>
          <input
            value={settings.submitLabel ?? ""}
            onChange={e => set("submitLabel", e.target.value || undefined)}
            placeholder="Invia"
            className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface"
          />
        </label>

        <div className="space-y-2">
          <div className="flex gap-4 text-[12px] text-fg-2">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="after-submit"
                checked={afterSubmit === "message"}
                onChange={() => set("redirectUrl", undefined)}
              />
              Mostra un messaggio
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="after-submit"
                checked={afterSubmit === "redirect"}
                onChange={() => set("redirectUrl", settings.redirectUrl || "https://")}
              />
              Reindirizza a una pagina
            </label>
          </div>
          {afterSubmit === "message" ? (
            <textarea
              value={settings.successMessage ?? ""}
              onChange={e => set("successMessage", e.target.value || undefined)}
              placeholder="Grazie! Ti risponderemo al più presto."
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface resize-none"
            />
          ) : (
            <input
              value={settings.redirectUrl ?? ""}
              onChange={e => set("redirectUrl", e.target.value)}
              placeholder="https://tuosito.it/grazie"
              className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface"
            />
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-fg">Etichette da applicare</h3>
        {tags.length === 0 ? (
          <p className="text-[12px] text-fg-3">Nessuna etichetta creata per questa azienda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(t => {
              const on = (settings.tagIds ?? []).includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className="text-[12px] px-2.5 py-1 rounded-full border transition-colors"
                  style={on
                    ? { backgroundColor: `${t.color}1a`, borderColor: t.color, color: t.color }
                    : { borderColor: "var(--border)", color: "var(--fg-3)" }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-fg">Opportunità</h3>
        <p className="text-[12px] text-fg-3">Se selezioni pipeline e fase, ogni invio crea automaticamente un&apos;opportunità.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-fg-2">Pipeline</span>
            <select
              value={settings.pipelineId ?? ""}
              onChange={e => onChange({ ...settings, pipelineId: e.target.value || undefined, stageId: undefined })}
              className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface"
            >
              <option value="">Nessuna</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[12px] font-medium text-fg-2">Fase</span>
            <select
              value={settings.stageId ?? ""}
              disabled={!selectedPipeline}
              onChange={e => set("stageId", e.target.value || undefined)}
              className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface disabled:bg-subtle"
            >
              <option value="">Prima fase aperta</option>
              {selectedPipeline?.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-fg">Responsabile e aspetto</h3>
        <label className="block space-y-1">
          <span className="text-[12px] font-medium text-fg-2">Responsabile del contatto</span>
          <select
            value={settings.ownerUserId ?? ""}
            onChange={e => set("ownerUserId", e.target.value || undefined)}
            className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface"
          >
            <option value="">Nessuno</option>
            {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-fg-2">Colore principale</span>
          <input
            type="color"
            value={settings.theme?.primaryColor ?? "#4f7deb"}
            onChange={e => set("theme", { ...settings.theme, primaryColor: e.target.value })}
            className="w-9 h-9 rounded-[var(--r-md)] border border-border bg-surface p-0.5"
          />
        </label>
      </section>
    </div>
  );
}
