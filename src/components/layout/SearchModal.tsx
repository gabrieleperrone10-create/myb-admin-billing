"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";
import { useCompanySlug } from "@/lib/useCompany";
import { companyPath } from "@/lib/paths";

const TYPE_COLORS: Record<string, string> = {
  Cliente:   "#4f7deb",
  Fattura:   "#8b5cf6",
  Contratto: "#10b981",
  Prodotto:  "#f59e0b",
  Spesa:     "#ef4444",
  SOP:       "#06b6d4",
  Evento:    "#ec4899",
  Team:      "#64748b",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const slug = useCompanySlug();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&company=${slug}`);
        const data = await res.json();
        setResults(data);
        setActiveIdx(0);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  function navigate(href: string) {
    router.push(companyPath(slug, href));
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) { navigate(results[activeIdx].href); }
  }

  if (!open) return null;

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  // flat index map for keyboard nav
  const flat = results;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[580px] mx-4 rounded-[var(--r-xl)] overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--fg-3)" }} strokeWidth={1.6} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca clienti, fatture, contratti, prodotti…"
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: "var(--fg)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-0.5" style={{ color: "var(--fg-3)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd
            className="hidden sm:flex items-center font-mono text-[10px] rounded px-1.5 py-0.5"
            style={{ color: "var(--fg-3)", backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--fg-3)" }} />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center py-10 gap-2">
              <Search className="w-8 h-8" style={{ color: "var(--fg-3)" }} strokeWidth={1.2} />
              <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>Nessun risultato per &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="px-4 pt-3 pb-1">
                    <span
                      className="font-mono text-[9px] uppercase"
                      style={{ color: TYPE_COLORS[type] ?? "var(--fg-3)", letterSpacing: "0.12em", fontWeight: 600 }}
                    >
                      {type}
                    </span>
                  </div>
                  {items.map(r => {
                    const idx = flat.indexOf(r);
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r.href)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--subtle)" : "transparent",
                          minHeight: "unset",
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: TYPE_COLORS[type] ?? "var(--fg-3)" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{r.label}</p>
                          {r.sublabel && (
                            <p className="text-[11px] truncate" style={{ color: "var(--fg-3)" }}>{r.sublabel}</p>
                          )}
                        </div>
                        {isActive && <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-3)" }} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className="flex flex-col items-center py-10 gap-2">
              <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Digita per cercare in tutto il software</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 text-[10px] font-mono"
          style={{ borderTop: "1px solid var(--border)", color: "var(--fg-3)" }}
        >
          <span><kbd className="px-1 rounded" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>↑↓</kbd> naviga</span>
          <span><kbd className="px-1 rounded" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>↵</kbd> apri</span>
          <span><kbd className="px-1 rounded" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>ESC</kbd> chiudi</span>
        </div>
      </div>
    </div>
  );
}
