"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Blocco di codice con pulsante "copia". Usato per link, snippet iframe e script di tracciamento. */
export function CopySnippet({ label, code, hint }: { label: string; code: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard non disponibile (http non sicuro, permessi negati): l'utente puo' sempre selezionare a mano
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-fg-2">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-info hover:underline shrink-0"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiato" : "Copia"}
        </button>
      </div>
      <pre className="bg-subtle border border-border rounded-[var(--r-md)] p-3 text-[11.5px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-fg-2">
        <code>{code}</code>
      </pre>
      {hint && <p className="text-[11px] text-fg-3">{hint}</p>}
    </div>
  );
}
