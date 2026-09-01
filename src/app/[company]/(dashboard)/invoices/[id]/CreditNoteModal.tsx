"use client";

import { useState, useTransition } from "react";
import { createCreditNoteFromInvoice } from "@/app/actions/creditNotes";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormField";
import { FileMinus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props { invoiceId: string; invoiceNumber: string; amount: number }

export default function CreditNoteModal({ invoiceId, invoiceNumber, amount }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const action = (formData: FormData) => {
    startTransition(async () => {
      await createCreditNoteFromInvoice(invoiceId, formData);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
      >
        <FileMinus className="w-3.5 h-3.5" /> Nota di credito
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Genera nota di credito</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Stai per generare una nota di credito a storno della fattura <strong>{invoiceNumber}</strong>.
              Verrà creato un nuovo documento numerato, separato dalla fattura.
            </p>

            <form action={action} className="space-y-4">
              <Input
                label="Importo da stornare"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={amount}
                hint={`Importo fattura: ${formatCurrency(amount)}. Modifica per uno storno parziale.`}
              />

              <Textarea
                label="Motivo"
                name="reason"
                required
                placeholder="es. Errore di fatturazione, reso, storno totale..."
              />

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={pending} className="flex-1">Conferma e genera</Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annulla</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
