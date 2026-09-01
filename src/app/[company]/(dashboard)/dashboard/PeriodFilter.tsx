"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Period = "day" | "week" | "month" | "year" | "all" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day",    label: "Oggi" },
  { value: "week",   label: "Settimana" },
  { value: "month",  label: "Mese" },
  { value: "year",   label: "Anno" },
  { value: "all",    label: "Da sempre" },
  { value: "custom", label: "Custom" },
];

export default function PeriodFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = (sp.get("period") ?? "month") as Period;
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo]     = useState(sp.get("to")   ?? "");

  function select(p: Period) {
    if (p === "custom") {
      const params = new URLSearchParams({ period: "custom" });
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      router.push(`/dashboard?${params.toString()}`);
    } else {
      router.push(`/dashboard?period=${p}`);
    }
  }

  function applyCustom() {
    const params = new URLSearchParams({ period: "custom" });
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    router.push(`/dashboard?${params.toString()}`);
  }

  const pill =
    "px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium transition-colors duration-100";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={cn(
            pill,
            current === value
              ? "bg-fg text-white"
              : "bg-subtle text-fg-2 hover:text-fg hover:bg-border/60"
          )}
        >
          {label}
        </button>
      ))}

      {current === "custom" && (
        <div className="flex items-center gap-2 flex-wrap mt-1 w-full sm:w-auto sm:mt-0">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[12px] text-fg bg-surface focus:outline-none focus:border-info"
          />
          <span className="text-fg-3 text-[12px]">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-border rounded-[var(--r-md)] px-2.5 py-1.5 text-[12px] text-fg bg-surface focus:outline-none focus:border-info"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium bg-fg text-white hover:bg-fg/90 transition-colors"
          >
            Applica
          </button>
        </div>
      )}
    </div>
  );
}
