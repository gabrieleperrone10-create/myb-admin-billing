"use client";
import { useTransition } from "react";
import { toggleAutomation } from "@/app/actions/automations";

export function AutomationToggle({ type, active, color }: { type: string; active: boolean; color: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => toggleAutomation(type, !active))}
      disabled={pending}
      aria-label={active ? "Disattiva" : "Attiva"}
      className="relative shrink-0"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <span
        className="flex items-center w-10 h-5 rounded-full transition-colors duration-200"
        style={{ backgroundColor: active ? color : "var(--border)" }}
      >
        <span
          className="w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: active ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}
