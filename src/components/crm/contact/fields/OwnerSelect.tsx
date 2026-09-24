"use client";

import { useState, useTransition } from "react";
import { updateContactOwner } from "@/app/actions/contactDetail";

export function OwnerSelect({
  slug,
  contactId,
  ownerUserId,
  members,
}: {
  slug: string;
  contactId: string;
  ownerUserId: string | null;
  members: { userId: string; name: string }[];
}) {
  const [value, setValue] = useState(ownerUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await updateContactOwner(slug, contactId, next || null);
      if (!res.ok) {
        setError(res.error);
        setValue(ownerUserId ?? "");
      }
    });
  }

  return (
    <div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={pending}
        className="w-full px-2 py-1.5 text-[13px] rounded-[6px] border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--fg)" }}
      >
        <option value="">Nessun responsabile</option>
        {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
      {error && <p className="text-[11px] mt-1" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
