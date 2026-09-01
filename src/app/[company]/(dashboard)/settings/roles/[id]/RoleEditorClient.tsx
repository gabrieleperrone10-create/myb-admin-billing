"use client";
import { useState } from "react";
import { Save, Check } from "lucide-react";
import { updateRole, updateRolePermissions } from "@/app/actions/roles";
import type { AppRole, AppRolePermission, AppSection, PermissionLevel } from "@prisma/client";

type RoleWithPerms = AppRole & { permissions: AppRolePermission[] };

const SECTION_LABELS: Record<AppSection, string> = {
  DASHBOARD:   "Dashboard",
  INVOICES:    "Fatture",
  CREDIT_NOTES:"Note di credito",
  CLIENTS:     "Clienti",
  EXPENSES:    "Spese",
  CONTRACTS:   "Contratti",
  PRODUCTS:    "Prodotti & Servizi",
  PAYMENTS:    "Pagamenti",
  DEPOSITS:    "Depositi",
  ACADEMY:     "Academy",
  SOP:         "SOP",
  EVENTS:      "Eventi",
  AUTOMATIONS: "Automazioni",
  TEAM:        "Team",
  SETTINGS:    "Impostazioni",
  KNOWLEDGE:   "Knowledge Base",
  USERS:       "Utenti & Ruoli",
  OBJECTIVES:  "Obiettivi",
};

const ALL_SECTIONS = Object.keys(SECTION_LABELS) as AppSection[];
const LEVELS: PermissionLevel[] = ["NONE", "VIEW", "EDIT", "FULL"];
const LEVEL_LABELS: Record<PermissionLevel, string> = {
  NONE: "Nessuno",
  VIEW: "Visualizza",
  EDIT: "Modifica",
  FULL: "Completo",
};
const LEVEL_COLORS: Record<PermissionLevel, string> = {
  NONE: "var(--fg-3)",
  VIEW: "#4f7deb",
  EDIT: "#f97316",
  FULL: "#22c55e",
};

const COLORS = ["#dc2626","#f97316","#eab308","#22c55e","#14b8a6","#4f7deb","#8b5cf6","#ec4899","#6b7280"];

export default function RoleEditorClient({ role, slug }: { role: RoleWithPerms; slug: string }) {
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description ?? "");
  const [color, setColor] = useState(role.color);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialPerms = Object.fromEntries(
    ALL_SECTIONS.map(s => {
      const found = role.permissions.find(p => p.section === s);
      return [s, (found?.level ?? "NONE") as PermissionLevel];
    })
  ) as Record<AppSection, PermissionLevel>;

  const [perms, setPerms] = useState(initialPerms);

  async function handleSave() {
    setLoading(true);
    const [metaRes, permRes] = await Promise.all([
      updateRole(slug, role.id, { name: name.trim(), description: desc.trim() || undefined, color }),
      updateRolePermissions(slug, role.id, ALL_SECTIONS.map(section => ({ section, level: perms[section] }))),
    ]);
    setLoading(false);
    if (metaRes.ok && permRes.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert(metaRes.error ?? permRes.error ?? "Errore salvataggio");
    }
  }

  return (
    <div className="space-y-6">
      {/* Meta card */}
      <div className="p-5 rounded-[var(--r-lg)]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-[13px] font-semibold mb-4 uppercase tracking-wider font-mono" style={{ color: "var(--fg-3)" }}>
          Informazioni ruolo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={role.isSystem}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: role.isSystem ? "var(--subtle)" : "var(--subtle)",
                color: "var(--fg)",
                opacity: role.isSystem ? 0.6 : 1,
              }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Breve descrizione"
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--fg-2)" }}>Colore</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  transform: color === c ? "scale(1.25)" : "scale(1)",
                  outline: color === c ? `2px solid ${c}` : "none",
                  outlineOffset: 2,
                  minHeight: "unset",
                  minWidth: "unset",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--fg-3)" }}>
            Permessi per sezione
          </h2>
        </div>

        {/* Desktop table header */}
        <div
          className="hidden md:grid px-4 py-2 text-[11px] font-semibold uppercase tracking-wider font-mono"
          style={{
            gridTemplateColumns: "1fr repeat(4, 100px)",
            backgroundColor: "var(--subtle)",
            borderBottom: "1px solid var(--border)",
            color: "var(--fg-3)",
          }}
        >
          <span>Sezione</span>
          {LEVELS.map(l => (
            <span key={l} className="text-center">{LEVEL_LABELS[l]}</span>
          ))}
        </div>

        {ALL_SECTIONS.map((section, i) => (
          <div
            key={section}
            style={{
              borderBottom: i < ALL_SECTIONS.length - 1 ? "1px solid var(--border)" : "none",
              backgroundColor: "var(--surface)",
            }}
          >
            {/* Desktop row */}
            <div
              className="hidden md:grid items-center px-4 py-2.5"
              style={{ gridTemplateColumns: "1fr repeat(4, 100px)" }}
            >
              <span className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                {SECTION_LABELS[section]}
              </span>
              {LEVELS.map(level => (
                <div key={level} className="flex justify-center">
                  <button
                    onClick={() => setPerms(p => ({ ...p, [section]: level }))}
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: perms[section] === level ? LEVEL_COLORS[level] : "var(--border)",
                      backgroundColor: perms[section] === level ? LEVEL_COLORS[level] + "20" : "transparent",
                      minHeight: "unset",
                      minWidth: "unset",
                    }}
                  >
                    {perms[section] === level && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[level] }} />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Mobile row */}
            <div className="md:hidden px-4 py-3">
              <p className="text-[13px] font-medium mb-2" style={{ color: "var(--fg)" }}>
                {SECTION_LABELS[section]}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {LEVELS.map(level => (
                  <button
                    key={level}
                    onClick={() => setPerms(p => ({ ...p, [section]: level }))}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor: perms[section] === level ? LEVEL_COLORS[level] + "18" : "var(--subtle)",
                      border: `1px solid ${perms[section] === level ? LEVEL_COLORS[level] : "var(--border)"}`,
                      color: perms[section] === level ? LEVEL_COLORS[level] : "var(--fg-3)",
                      minHeight: "unset",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: perms[section] === level ? LEVEL_COLORS[level] : "var(--border)" }}
                    />
                    {LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold transition-colors"
          style={{
            backgroundColor: saved ? "#22c55e" : "var(--fg)",
            color: "var(--surface)",
            minHeight: "unset",
          }}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {loading ? "Salvataggio..." : saved ? "Salvato!" : "Salva permessi"}
        </button>
      </div>
    </div>
  );
}
