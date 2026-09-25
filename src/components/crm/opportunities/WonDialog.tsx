"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";
import { convertOpportunityToClientAction } from "@/app/actions/opportunities";

/**
 * Dialog mostrato subito dopo che un'opportunità entra in una fase WON
 * (drag & drop o azione esplicita). L'opportunità è già segnata vinta a
 * questo punto: qui si sceglie solo il passo successivo.
 */
export function WonDialog({
  opportunityId, opportunityName, onClose, canCreateContract = true,
}: {
  opportunityId: string;
  opportunityName: string;
  onClose: () => void;
  canCreateContract?: boolean;
}) {
  const slug = useCompanySlug();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function convertAndGoToContract() {
    setLoading(true);
    setError("");
    const res = await convertOpportunityToClientAction(slug, opportunityId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    const params = new URLSearchParams({ clientId: res.data.clientId, opportunityId: res.data.opportunityId });
    if (res.data.productId) params.set("productId", res.data.productId);
    if (res.data.amount) params.set("amount", String(res.data.amount));
    router.push(`/${slug}/contracts/new?${params.toString()}`);
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] animate-fade-in" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose} />
      <div
        className="fixed z-[60] left-1/2 w-full max-w-sm"
        style={{
          top: "50%", transform: "translate(-50%, -50%)",
          backgroundColor: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <PartyPopper className="w-5 h-5" style={{ color: "var(--ok)" }} />
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Opportunità vinta!</h2>
        </div>
        <p className="text-[13px] mb-5" style={{ color: "var(--fg-2)" }}>
          &ldquo;{opportunityName}&rdquo; è stata segnata come vinta. Vuoi generare subito il cliente di fatturazione e il contratto?
        </p>

        {error && (
          <div className="px-3 py-2 rounded-[var(--r-md)] text-[12px] mb-3" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>{error}</div>
        )}

        <div className="space-y-2">
          {canCreateContract && <button
            onClick={convertAndGoToContract}
            disabled={loading}
            className="w-full py-2.5 rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ backgroundColor: "var(--fg)", color: "var(--surface)", minHeight: "unset" }}
          >
            {loading ? "Attendere…" : "Crea cliente e vai al contratto"}
          </button>}
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 rounded-[var(--r-md)] text-[13px]"
            style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
          >
            Solo segna vinta
          </button>
        </div>
      </div>
    </>
  );
}
