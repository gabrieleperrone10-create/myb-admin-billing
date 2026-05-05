"use client";

import { useState, useTransition } from "react";
import { markInvoicePaid } from "@/app/actions/invoices";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormField";
import { CheckCircle, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const METHOD_OPTIONS = [
  { value: "BANK_TRANSFER", label: "Bonifico Bancario" },
  { value: "STRIPE", label: "Stripe" },
  { value: "PAYPAL", label: "PayPal" },
];

interface Props { invoiceId: string; amount: number }

export default function MarkPaidModal({ invoiceId, amount }: Props) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [pending, startTransition] = useTransition();

  const action = (formData: FormData) => {
    startTransition(async () => {
      await markInvoicePaid(invoiceId, formData);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
      >
        <CheckCircle className="w-3.5 h-3.5" /> Segna pagata
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Registra pagamento</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="amount" value={amount} />

              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-500">Importo ricevuto</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(amount)}</p>
              </div>

              <Select
                label="Metodo di pagamento"
                name="method"
                options={METHOD_OPTIONS}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                required
              />

              <Input
                label="Data pagamento"
                name="paidAt"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />

              {method === "BANK_TRANSFER" && (
                <Input label="Riferimento bonifico" name="reference" placeholder="es. BON-2025-001" />
              )}
              {method === "STRIPE" && (
                <Input label="ID pagamento Stripe" name="stripePaymentId" placeholder="pi_..." />
              )}
              {method === "PAYPAL" && (
                <Input label="ID ordine PayPal" name="paypalOrderId" placeholder="PP-..." />
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={pending} className="flex-1">Conferma pagamento</Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annulla</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
