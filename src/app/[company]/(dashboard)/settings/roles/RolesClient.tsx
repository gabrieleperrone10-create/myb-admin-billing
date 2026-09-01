"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, Shield, Users } from "lucide-react";
import { createRole, deleteRole } from "@/app/actions/roles";
import type { AppRole, AppRolePermission } from "@prisma/client";

type RoleWithCount = AppRole & {
  permissions: AppRolePermission[];
  _count: { userRoles: number };
};

export default function RolesClient({ roles, slug }: { roles: RoleWithCount[]; slug: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#4f7deb");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setErr("");
    const res = await createRole(slug, { name: name.trim(), description: desc.trim() || undefined, color });
    setLoading(false);
    if (res.ok) {
      setName(""); setDesc(""); setColor("#4f7deb");
      setCreateOpen(false);
    } else {
      setErr(res.error ?? "Errore");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminare il ruolo "${name}"? Gli utenti con questo ruolo perderanno questi permessi.`)) return;
    const res = await deleteRole(slug, id);
    if (!res.ok) alert(res.error);
  }

  const COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#4f7deb", "#8b5cf6", "#ec4899", "#6b7280"];

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <Plus className="w-4 h-4" />
          Nuovo ruolo
        </button>
      </div>

      <div className="space-y-2">
        {roles.map(role => (
          <div
            key={role.id}
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--r-lg)]"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {/* Color dot */}
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{role.name}</p>
                {role.isSystem && (
                  <span
                    className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)", border: "1px solid var(--border)" }}
                  >
                    sistema
                  </span>
                )}
              </div>
              {role.description && (
                <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-3)" }}>{role.description}</p>
              )}
              <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: "var(--fg-3)" }}>
                <Users className="w-3 h-3" />
                {role._count.userRoles} {role._count.userRoles === 1 ? "utente" : "utenti"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={`/${slug}/settings/roles/${role.id}`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modifica</span>
              </Link>
              {!role.isSystem && (
                <button
                  onClick={() => handleDelete(role.id, role.name)}
                  className="flex items-center justify-center rounded-[var(--r-md)]"
                  style={{ width: 34, height: 34, border: "1px solid var(--border)", color: "#dc2626", minHeight: "unset", minWidth: "unset" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Legenda livelli */}
      <div
        className="mt-6 p-4 rounded-[var(--r-lg)]"
        style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}
      >
        <p className="text-[12px] font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--fg-2)" }}>
          <Shield className="w-3.5 h-3.5" /> Livelli di accesso
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
          {[
            { level: "Nessuno", desc: "Sezione nascosta" },
            { level: "Visualizza", desc: "Solo lettura" },
            { level: "Modifica", desc: "Crea e modifica" },
            { level: "Completo", desc: "Include eliminazione" },
          ].map(l => (
            <div key={l.level}>
              <p className="font-semibold" style={{ color: "var(--fg-2)" }}>{l.level}</p>
              <p style={{ color: "var(--fg-3)" }}>{l.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create modal */}
      {createOpen && (
        <>
          <div
            className="fixed inset-0 z-50 animate-fade-in"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={() => setCreateOpen(false)}
          />
          <div
            className="fixed z-50 left-1/2 w-full max-w-sm"
            style={{
              top: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xl)",
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuovo ruolo</h2>
              <button onClick={() => setCreateOpen(false)} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome ruolo</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="es. Responsabile Marketing"
                  className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Descrizione (opzionale)</label>
                <input
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Breve descrizione del ruolo"
                  className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                />
              </div>
              <div>
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

            {err && <p className="text-[12px] mt-3" style={{ color: "#dc2626" }}>{err}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
                style={{
                  backgroundColor: name.trim() && !loading ? "var(--fg)" : "var(--subtle)",
                  color: name.trim() && !loading ? "var(--surface)" : "var(--fg-3)",
                  minHeight: "unset",
                }}
              >
                {loading ? "Creazione..." : "Crea ruolo"}
              </button>
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-[var(--r-md)] text-[13px]"
                style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
              >
                Annulla
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
