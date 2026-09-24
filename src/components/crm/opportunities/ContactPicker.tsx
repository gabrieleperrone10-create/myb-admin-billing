"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, X, Check } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { searchContactsForOpportunity, quickCreateContact } from "@/app/actions/opportunities";

export type PickedContact = { id: string; name: string; email: string | null; companyName: string | null };

export function ContactPicker({
  value, onChange, disabled,
}: {
  value: PickedContact | null;
  onChange: (contact: PickedContact | null) => void;
  disabled?: boolean;
}) {
  const slug = useCompanySlug();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedContact[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickError, setQuickError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const rows = await searchContactsForOpportunity(slug, query);
      setResults(rows);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query, open, slug]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--r-md)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)" }}>
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{value.name}</p>
          {(value.email || value.companyName) && (
            <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>{[value.companyName, value.email].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} style={{ color: "var(--fg-3)", minHeight: "unset", minWidth: "unset" }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setLoading(true); }}
          onFocus={() => { setOpen(true); setLoading(true); }}
          placeholder="Cerca contatto per nome, email o telefono…"
          disabled={disabled}
          className="w-full pl-8 pr-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
        />
      </div>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-[var(--r-lg)] overflow-hidden animate-scale-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.14)", maxHeight: 280, overflowY: "auto" }}
        >
          {loading && <p className="px-3 py-2.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Ricerca…</p>}
          {!loading && results.length === 0 && !creating && (
            <p className="px-3 py-2.5 text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun contatto trovato</p>
          )}
          {!loading && results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors"
              style={{ color: "var(--fg)", minHeight: "unset" }}
            >
              <span className="font-medium">{c.name}</span>
              {(c.companyName || c.email) && <span style={{ color: "var(--fg-3)" }}> · {[c.companyName, c.email].filter(Boolean).join(" · ")}</span>}
            </button>
          ))}

          <div style={{ borderTop: "1px solid var(--border)" }}>
            {!creating ? (
              <button
                type="button"
                onClick={() => { setCreating(true); setQuickName(query); }}
                className="w-full flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium hover:bg-subtle transition-colors"
                style={{ color: "var(--info)", minHeight: "unset" }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Crea nuovo contatto
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <input
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  placeholder="Nome e cognome"
                  autoFocus
                  className="w-full px-2.5 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                />
                <div className="flex gap-2">
                  <input
                    value={quickEmail}
                    onChange={e => setQuickEmail(e.target.value)}
                    placeholder="Email"
                    className="flex-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                  />
                  <input
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="Telefono"
                    className="flex-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[13px] outline-none"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--subtle)", color: "var(--fg)" }}
                  />
                </div>
                {quickError && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{quickError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setQuickError("");
                      const res = await quickCreateContact(slug, { name: quickName, email: quickEmail, phone: quickPhone });
                      if (res.ok) { onChange(res.data); setOpen(false); setCreating(false); setQuery(""); }
                      else setQuickError(res.error);
                    }}
                    disabled={!quickName.trim()}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium"
                    style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
                  >
                    <Check className="w-3.5 h-3.5" /> Crea e seleziona
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="px-3 py-1.5 rounded-[var(--r-md)] text-[12px]"
                    style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
