"use client";

import { useState, useTransition } from "react";
import { updateAutomationConfig } from "@/app/actions/automations";
import { Check } from "lucide-react";

interface Props {
  type: string;
  label: string;
  field: string;
  currentValue: string;
  placeholder?: string;
}

export function AutomationConfigInput({ type, label, field, currentValue, placeholder }: Props) {
  const [value, setValue] = useState(currentValue);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await updateAutomationConfig(type, { [field]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[11px] text-gray-500 shrink-0">{label}</span>
      <input
        type="email"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        placeholder={placeholder}
        className="flex-1 text-[12px] px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
      />
      <button
        onClick={save}
        disabled={pending || value === currentValue}
        className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-40"
        style={{ backgroundColor: saved ? "#3b9e6a18" : "#4f7deb18", color: saved ? "#3b9e6a" : "#4f7deb" }}
      >
        {saved ? <><Check className="w-3 h-3 inline mr-0.5" />Salvato</> : "Salva"}
      </button>
    </div>
  );
}
