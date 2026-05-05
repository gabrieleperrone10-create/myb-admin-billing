"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createInvoice } from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

interface LineItem { description: string; quantity: number; unitPrice: number; total: number }
interface Client { id: string; name: string; company: string | null }
interface Contract { id: string; clientId: string; amount: number; product: { name: string } }

interface Props {
  clients: Client[];
  contracts: Contract[];
}

const defaultDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

export default function InvoiceForm({ clients, contracts }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const router = useRouter();

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} — ${c.company}` : c.name,
  }));

  const clientContracts = contracts.filter((c) => c.clientId === selectedClientId);
  const contractOptions = [
    { value: "", label: "Nessun contratto" },
    ...clientContracts.map((c) => ({ value: c.id, label: `${c.product.name} — €${c.amount}` })),
  ];

  const total = lineItems.reduce((s, li) => s + li.total, 0);

  const updateLine = (i: number, field: keyof LineItem, val: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[i], [field]: field === "description" ? val : parseFloat(val) || 0 };
      item.total = item.quantity * item.unitPrice;
      next[i] = item;
      return next;
    });
  };

  const addLine = () => setLineItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const removeLine = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));

  const action = (formData: FormData) => {
    formData.set("lineItems", JSON.stringify(lineItems));
    startTransition(async () => { await createInvoice(formData); });
  };

  return (
    <form action={action} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Destinatario</h2>
        <Select
          label="Cliente"
          name="clientId"
          required
          options={clientOptions}
          placeholder="Seleziona cliente..."
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        />
        {selectedClientId && (
          <Select label="Contratto collegato (opzionale)" name="contractId" options={contractOptions} />
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Date</h2>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Data emissione" name="issueDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          <Input label="Scadenza" name="dueDate" type="date" required defaultValue={defaultDueDate()} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Voci fattura</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Aggiungi riga
          </Button>
        </div>

        <div className="space-y-3">
          {lineItems.map((li, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1.5">Descrizione</label>}
                <input
                  value={li.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  placeholder="Descrizione servizio..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1.5">Qtà</label>}
                <input
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1.5">Prezzo €</label>}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={li.unitPrice}
                  onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1.5">Totale</label>}
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900">
                  {formatCurrency(li.total)}
                </div>
              </div>
              <div className="col-span-1 flex justify-center">
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-4 flex justify-end">
          <div className="text-right">
            <p className="text-sm text-gray-500">Totale fattura</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <Textarea label="Note (opzionale)" name="notes" placeholder="Note aggiuntive da includere in fattura..." />
      </section>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Crea fattura</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annulla</Button>
      </div>
    </form>
  );
}
