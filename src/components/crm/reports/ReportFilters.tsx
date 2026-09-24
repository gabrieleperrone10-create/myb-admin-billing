"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/lib/crm/reports/period";

type Option = { id: string; name: string };

/**
 * Filtri globali dei report, tutti nell'URL: period, from, to, pipeline, owner.
 * La tab corrente (e ogni altro parametro) si conserva.
 * Props solo serializzabili: nessuna funzione arriva dal Server Component.
 */
export function ReportFilters({
  preset,
  fromDay,
  toDay,
  pipelines,
  members,
  pipelineId,
  ownerId,
  showPipeline = true,
  showOwner = true,
  allPipelinesLabel = "Tutte",
}: {
  preset: PeriodPreset;
  fromDay: string;
  toDay: string;
  pipelines: Option[];
  members: Option[];
  pipelineId: string;
  ownerId: string;
  showPipeline?: boolean;
  showOwner?: boolean;
  /** Voce "tutte le pipeline" (null = obbligo di sceglierne una, es. imbuto) */
  allPipelinesLabel?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(fromDay);
  const [to, setTo] = useState(toDay);
  const [customOpen, setCustomOpen] = useState(preset === "custom");

  function push(changes: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function selectPreset(p: PeriodPreset) {
    if (p === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    push({ period: p, from: null, to: null });
  }

  const pill = "px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium transition-colors duration-100";
  const select =
    "border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[12px] text-fg bg-surface focus:outline-none focus:border-info max-w-[220px]";
  const activePreset = customOpen ? "custom" : preset;

  return (
    <div className={cn("flex flex-col gap-2 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIOD_PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => selectPreset(p)}
            aria-pressed={activePreset === p}
            className={cn(
              pill,
              activePreset === p ? "bg-fg text-white" : "bg-subtle text-fg-2 hover:text-fg hover:bg-border/60",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}

        {(showPipeline || showOwner) && <span className="hidden sm:block w-px h-5 bg-border mx-1" aria-hidden />}

        {showPipeline && pipelines.length > 0 && (
          <label className="flex items-center gap-1.5 text-[12px] text-fg-3">
            Pipeline
            <select className={select} value={pipelineId} onChange={e => push({ pipeline: e.target.value })}>
              {allPipelinesLabel && <option value="">{allPipelinesLabel}</option>}
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

        {showOwner && (
          <label className="flex items-center gap-1.5 text-[12px] text-fg-3">
            Responsabile
            <select className={select} value={ownerId} onChange={e => push({ owner: e.target.value })}>
              <option value="">Tutti</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {customOpen && (
        <form
          className="flex items-center gap-2 flex-wrap"
          onSubmit={e => {
            e.preventDefault();
            if (from && to) push({ period: "custom", from, to });
          }}
        >
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} aria-label="Dal"
            className="border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[12px] text-fg bg-surface focus:outline-none focus:border-info" />
          <span className="text-fg-3 text-[12px]">→</span>
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} aria-label="Al"
            className="border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[12px] text-fg bg-surface focus:outline-none focus:border-info" />
          <button type="submit" disabled={!from || !to}
            className="px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium bg-fg text-white hover:bg-fg/90 transition-colors disabled:opacity-40">
            Applica
          </button>
        </form>
      )}
    </div>
  );
}
