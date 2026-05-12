"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createContract } from "@/app/actions/contracts";
import { formatCurrency } from "@/lib/utils";

interface Client { id: string; name: string; company: string | null }
interface Product { id: string; name: string; type: string; basePrice: number }

interface Props {
  clients: Client[];
  products: Product[];
}

const TYPE_OPTIONS = [
  { value: "RECURRING", label: "Ricorrente" },
  { value: "ONE_SHOT",  label: "Una tantum / Rate" },
];

const PERIOD_OPTIONS = [
  { value: "MONTHLY",   label: "Mensile" },
  { value: "QUARTERLY", label: "Trimestrale" },
  { value: "ANNUALLY",  label: "Annuale" },
];

const DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Giorno ${i + 1}` }));

export default function ContractForm({ clients, products }: Props) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"RECURRING" | "ONE_SHOT">("RECURRING");
  const [hasDeposit, setHasDeposit] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("3");
  const router = useRouter();

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const installmentAmount = type === "ONE_SHOT" && amount && parseInt(installments) > 1
    ? parseFloat(amount) / parseInt(installments)
    : null;

  const clientOptions  = clients.map((c)  => ({ value: c.id,  label: c.company ? `${c.name} — ${c.company}` : c.name }));
  const productOptions = products.map((p) => ({ value: p.id,  label: `${p.name} (€${p.basePrice})` }));

  const action = (formData: FormData) => {
    formData.set("hasDeposit", String(hasDeposit));
    startTransition(async () => { await createContract(formData); });
  };

  return (
    <form action={action} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Dati contratto</h2>
        <Select label="Cliente" name="clientId" required options={clientOptions} placeholder="Seleziona cliente..." />
        <Select
          label="Prodotto / Servizio"
          name="productId"
          required
          options={productOptions}
          placeholder="Seleziona prodotto..."
          value={selectedProductId}
          onChange={(e) => {
            setSelectedProductId(e.target.value);
            const p = products.find(p => p.id === e.target.value);
            if (p) setAmount(String(p.basePrice));
          }}
        />
        <Select
          label="Tipo contratto"
          name="type"
          required
          options={TYPE_OPTIONS}
          value={type}
          onChange={(e) => setType(e.target.value as "RECURRING" | "ONE_SHOT")}
        />
        <Input
          label={type === "RECURRING" ? "Importo per periodo (EUR)" : "Importo totale (EUR)"}
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={selectedProduct ? `Prezzo base: €${selectedProduct.basePrice}` : undefined}
        />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Piano di fatturazione</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input label="Data inizio" name="startDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          <Input label="Data fine (opzionale)" name="endDate" type="date" />
          <Select label="Periodo di fatturazione" name="billingPeriod" options={PERIOD_OPTIONS} defaultValue="MONTHLY" />
          <Select label="Giorno di fatturazione" name="billingDay" options={DAYS} defaultValue="1" />
        </div>

        {type === "ONE_SHOT" && (
          <div className="space-y-3">
            <Input
              label="Numero di rate"
              name="installments"
              type="number"
              min="1"
              max="60"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              hint="Inserisci 1 per pagamento unico"
            />
            {installmentAmount && installmentAmount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                {parseInt(installments)} rate da <strong>{formatCurrency(installmentAmount)}</strong> cadauna
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Deposito</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasDeposit} onChange={(e) => setHasDeposit(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-sm text-gray-600">Richiedi deposito</span>
          </label>
        </div>
        {hasDeposit && (
          <Input
            label="Importo deposito (EUR)"
            name="depositAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue="500"
            hint="Pagato prima dell'avvio del piano rate"
          />
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <Textarea label="Note interne" name="notes" placeholder="Condizioni particolari, accordi, ecc." />
      </section>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Crea contratto</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annulla</Button>
      </div>
    </form>
  );
}
