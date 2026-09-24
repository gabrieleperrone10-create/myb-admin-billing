"use client";

import { useState, useTransition } from "react";
import { updateContactOptOut } from "@/app/actions/contactDetail";

export function OptOutToggle({
  slug,
  contactId,
  field,
  label,
  initial,
}: {
  slug: string;
  contactId: string;
  field: "emailOptOut" | "whatsappOptOut";
  label: string;
  initial: boolean;
}) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onChange(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const res = await updateContactOptOut(slug, contactId, field, next);
      if (!res.ok) setChecked(!next);
    });
  }

  return (
    <label className="flex items-center justify-between gap-3 text-[13px] py-1" style={{ color: "var(--fg)" }}>
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={e => onChange(e.target.checked)}
      />
    </label>
  );
}
