"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

export function DeleteConfirmButton({
  action,
  message = "Eliminare definitivamente?",
  label = "Elimina",
}: {
  action: () => Promise<void>;
  message?: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(message)) {
          startTransition(() => action());
        }
      }}
      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {pending ? "..." : label}
    </button>
  );
}
