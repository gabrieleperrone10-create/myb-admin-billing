"use client";
import { useState } from "react";
import { UserPlus, X, Trash2, Plus, ShieldCheck } from "lucide-react";
import { createNewUser, assignRole, removeRole, removeUser } from "@/app/actions/users";

type Role = { id: string; name: string; color: string };
type User = { id: string; email: string; name: string; imageUrl: string; createdAt: Date; roles: Role[] };

export default function UsersClient({
  users,
  roles,
}: {
  users: User[];
  roles: Role[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [manageUser, setManageUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleId: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function resetForm() {
    setForm({ email: "", firstName: "", lastName: "", roleId: "" });
    setErr("");
  }

  async function handleCreate() {
    if (!form.email.trim()) return;
    setLoading(true);
    setErr("");
    const res = await createNewUser({
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      roleId: form.roleId || undefined,
    });
    setLoading(false);
    if (res.ok) {
      resetForm();
      setCreateOpen(false);
    } else {
      setErr(res.error ?? "Errore");
    }
  }

  async function handleAssign(userId: string, roleId: string) {
    await assignRole(userId, roleId);
    if (manageUser) {
      const role = roles.find(r => r.id === roleId);
      if (role && !manageUser.roles.find(r => r.id === roleId)) {
        setManageUser({ ...manageUser, roles: [...manageUser.roles, role] });
      }
    }
  }

  async function handleRemoveRole(userId: string, roleId: string) {
    await removeRole(userId, roleId);
    if (manageUser) {
      setManageUser({ ...manageUser, roles: manageUser.roles.filter(r => r.id !== roleId) });
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!confirm("Eliminare questo utente? L'operazione è irreversibile.")) return;
    await removeUser(userId);
    setManageUser(null);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setCreateOpen(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
        >
          <UserPlus className="w-4 h-4" />
          Aggiungi utente
        </button>
      </div>

      <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
          <p className="text-[12px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--fg-3)" }}>
            Utenti — {users.length}
          </p>
        </div>
        {users.map((user, i) => (
          <div
            key={user.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: i < users.length - 1 ? "1px solid var(--border)" : "none",
              backgroundColor: "var(--surface)",
            }}
          >
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover" />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[14px] font-semibold"
                style={{ backgroundColor: "var(--subtle)", color: "var(--fg)" }}
              >
                {user.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium truncate" style={{ color: "var(--fg)" }}>{user.name}</p>
              <p className="text-[12px] truncate" style={{ color: "var(--fg-3)" }}>{user.email}</p>
              {user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.roles.map(r => (
                    <span
                      key={r.id}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: r.color + "18", color: r.color }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setManageUser(user)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium shrink-0"
              style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ruoli</span>
            </button>
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--fg-3)" }}>
            Nessun utente trovato
          </div>
        )}
      </div>

      {/* Create user modal */}
      {createOpen && (
        <Modal title="Aggiungi utente" onClose={() => { setCreateOpen(false); resetForm(); }}>
          <p className="text-[13px] mb-4" style={{ color: "var(--fg-3)" }}>
            L'utente riceverà un'email con le istruzioni per impostare la password e accedere.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Nome</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Mario"
                  className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Cognome</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Rossi"
                  className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="mario@esempio.com"
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1" style={{ color: "var(--fg-2)" }}>Ruolo (opzionale)</label>
              <select
                value={form.roleId}
                onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                className="w-full px-3 py-2 rounded-[var(--r-md)] text-[14px] outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
              >
                <option value="">Nessun ruolo</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          {err && <p className="text-[12px] mt-3" style={{ color: "#dc2626" }}>{err}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={loading || !form.email.trim()}
              className="flex-1 py-2 rounded-[var(--r-md)] text-[13px] font-semibold"
              style={{
                backgroundColor: form.email.trim() && !loading ? "var(--fg)" : "var(--subtle)",
                color: form.email.trim() && !loading ? "var(--surface)" : "var(--fg-3)",
                minHeight: "unset",
              }}
            >
              {loading ? "Creazione..." : "Crea utente"}
            </button>
            <button
              onClick={() => { setCreateOpen(false); resetForm(); }}
              className="px-4 py-2 rounded-[var(--r-md)] text-[13px]"
              style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
            >
              Annulla
            </button>
          </div>
        </Modal>
      )}

      {/* Manage roles modal */}
      {manageUser && (
        <Modal title={`Ruoli — ${manageUser.name}`} onClose={() => setManageUser(null)}>
          <p className="text-[12px] mb-4" style={{ color: "var(--fg-3)" }}>{manageUser.email}</p>
          <p className="text-[12px] font-medium mb-2" style={{ color: "var(--fg-2)" }}>Ruoli assegnati</p>
          <div className="space-y-2 mb-4">
            {manageUser.roles.length === 0 && (
              <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>Nessun ruolo assegnato</p>
            )}
            {manageUser.roles.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)]" style={{ backgroundColor: "var(--subtle)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 text-[13px] font-medium" style={{ color: "var(--fg)" }}>{r.name}</span>
                <button
                  onClick={() => handleRemoveRole(manageUser.id, r.id)}
                  className="flex items-center justify-center rounded"
                  style={{ color: "var(--fg-3)", width: 24, height: 24, minHeight: "unset", minWidth: "unset" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-[12px] font-medium mb-2" style={{ color: "var(--fg-2)" }}>Aggiungi ruolo</p>
          <div className="space-y-1.5">
            {roles.filter(r => !manageUser.roles.find(ur => ur.id === r.id)).map(r => (
              <button
                key={r.id}
                onClick={() => handleAssign(manageUser.id, r.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] text-left transition-colors"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", minHeight: "unset" }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="flex-1 text-[13px]" style={{ color: "var(--fg)" }}>{r.name}</span>
                <Plus className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
              </button>
            ))}
          </div>
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => handleRemoveUser(manageUser.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--r-md)] text-[13px]"
              style={{ color: "#dc2626", border: "1px solid #dc262630", minHeight: "unset" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Elimina utente
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 animate-fade-in"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 left-1/2 w-full max-w-sm animate-scale-in"
        style={{
          top: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "24px",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 28, height: 28, minHeight: "unset", minWidth: "unset", color: "var(--fg-3)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
