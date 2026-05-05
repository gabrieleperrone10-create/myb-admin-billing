"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createExpense, updateExpense, deleteExpense } from "@/app/actions/expenses";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expenses";

interface ExistingExpense {
  id: string;
  date: Date;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  notes: string | null;
}

interface Props {
  existing?: ExistingExpense;
}

export default function ExpenseForm({ existing }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      if (existing) {
        await updateExpense(existing.id, fd);
      } else {
        await createExpense(fd);
      }
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!confirm("Eliminare questa spesa?")) return;
    startTransition(async () => {
      await deleteExpense(existing.id);
    });
  };

  const defaultDate = existing
    ? new Date(existing.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5" style={{ maxWidth: 560 }}>

      <div className="grid grid-cols-2 gap-4">
        <Input
          name="date"
          label="Data"
          type="date"
          defaultValue={defaultDate}
          required
        />
        <Input
          name="amount"
          label="Importo (€)"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          defaultValue={existing?.amount?.toString()}
          required
        />
      </div>

      <Select
        name="category"
        label="Categoria"
        options={EXPENSE_CATEGORY_OPTIONS}
        defaultValue={existing?.category}
        required
      />

      <Input
        name="description"
        label="Descrizione"
        placeholder="es. Abbonamento Notion Pro"
        defaultValue={existing?.description}
        required
      />

      <Input
        name="vendor"
        label="Fornitore"
        placeholder="es. Notion Labs Inc."
        defaultValue={existing?.vendor ?? ""}
      />

      <Textarea
        name="notes"
        label="Note"
        placeholder="Note opzionali…"
        rows={3}
        defaultValue={existing?.notes ?? ""}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {existing ? "Aggiorna spesa" : "Registra spesa"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Annulla
        </Button>
        {existing && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={pending}
            style={{ color: "var(--danger)", marginLeft: "auto" }}
          >
            Elimina
          </Button>
        )}
      </div>
    </form>
  );
}
