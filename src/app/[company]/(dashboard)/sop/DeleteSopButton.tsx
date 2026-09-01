"use client";
import { useState } from "react";
import { deleteSop } from "@/app/actions/sop";
import { useCompanySlug } from "@/lib/useCompany";
import { Trash2 } from "lucide-react";

export function DeleteSopButton({ sopId, sopTitle }: { sopId: string; sopTitle: string }) {
  const slug = useCompanySlug();
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!confirm(`Eliminare "${sopTitle}"?`)) return;
    setLoading(true);
    await deleteSop(slug, sopId);
  }

  return (
    <button onClick={handle} disabled={loading} className="p-1.5 rounded-[6px]" style={{ border: "1px solid var(--border)", color: "#dc2626" }} title="Elimina">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
