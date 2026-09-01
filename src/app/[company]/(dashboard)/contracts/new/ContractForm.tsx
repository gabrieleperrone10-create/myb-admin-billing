"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createContract } from "@/app/actions/contracts";
import { useCompanySlug } from "@/lib/useCompany";
import { formatCurrency } from "@/lib/utils";

interface Client  { id: string; name: string; company: string | null }
interface Product { id: string; name: string; type: string; basePrice: number }

interface Props { clients: Client[]; products: Product[] }

type ContractType = "RECURRING" | "INSTALLMENT" | "ONE_SHOT";

const PERIOD_OPTIONS = [
  { value: "MONTHLY",   label: "Mensile" },
  { value: "QUARTERLY", label: "Trimestrale" },
  { value: "ANNUALLY",  label: "Annuale" },
];

const DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Giorno ${i + 1}` }));

const TYPE_TABS: { key: ContractType; label: string; desc: string }[] = [
  { key: "RECURRING",   label: "Ricorrente",  desc: "Rata fissa ogni periodo, senza fine (o con data fine)" },
  { key: "INSTALLMENT", label: "A Rate",       desc: "Importo totale diviso in N rate con frequenza propria" },
  { key: "ONE_SHOT",    label: "Una Tantum",   desc: "Pagamento unico, eventualmente con deposito" },
];

export default function ContractForm({ clients, products }: Props) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<ContractType>("RECURRING");
  const [hasDeposit, setHasDeposit] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("3");
  const router = useRouter();

  const selectedProduct   = products.find(p => p.id === selectedProductId);
  const clientOptions     = clients.map(c  => ({ value: c.id,  label: c.company ? `${c.name} — ${c.company}` : c.name }));
  const productOptions    = products.map(p => ({ value: p.id,  label: `${p.name} (€${p.basePrice})` }));
  const installmentAmount = type === "INSTALLMENT" && amount && parseInt(installments) > 0
    ? parseFloat(amount) / parseInt(installments)
    : null;

  const slug = useCompanySlug();
  const action = (formData: FormData) => {
    formData.set("type", type);
    formData.set("hasDeposit", String(hasDeposit));
    startTransition(async () => { await createContract(slug, formData); });
  };

  return (
    <form action={action} className="space-y-6">

      {/* Tipo contratto */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Tipo contratto</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TYPE_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className="text-left p-4 rounded-lg border-2 transition-all"
              style={{
                borderColor: type === t.key ? "#4f7deb" : "#e5e7eb",
                backgroundColor: type === t.key ? "#eef2ff" : "white",
              }}
            >
              <p className="font-semibold text-sm" style={{ color: type === t.key ? "#4f7deb" : "#111827" }}>{t.label}</p>
              <p className="text-xs mt-1" style={{ color: "#6b7280" }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Cliente + Prodotto */}
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
          onChange={e => {
            setSelectedProductId(e.target.value);
            const p = products.find(p => p.id === e.target.value);
            if (p) setAmount(String(p.basePrice));
          }}
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
          onChange={e => setAmount(e.target.value)}
          hint={selectedProduct ? `Prezzo base: €${selectedProduct.basePrice}` : undefined}
        />
      </section>

      {/* Piano di fatturazione */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Piano di fatturazione</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input label="Data inizio" name="startDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
          {type !== "ONE_SHOT" && (
            <Input label={type === "INSTALLMENT" ? "Data fine percorso (opzionale)" : "Data fine (opzionale)"} name="endDate" type="date" />
          )}
        </div>

        {/* RECURRING: periodo + giorno */}
        {type === "RECURRING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select label="Frequenza fatturazione" name="billingPeriod" options={PERIOD_OPTIONS} defaultValue="MONTHLY" />
            <Select label="Giorno di fatturazione" name="billingDay" options={DAYS} defaultValue="1" />
          </div>
        )}

        {/* INSTALLMENT: rate + frequenza + giorno */}
        {type === "INSTALLMENT" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Input
                label="Numero di rate"
                name="installments"
                type="number"
                min="2"
                max="60"
                required
                value={installments}
                onChange={e => setInstallments(e.target.value)}
              />
              <Select label="Frequenza rate" name="billingPeriod" options={PERIOD_OPTIONS} defaultValue="MONTHLY" />
              <Select label="Giorno di fatturazione" name="billingDay" options={DAYS} defaultValue="1" />
            </div>
            {installmentAmount && installmentAmount > 0 && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3" }}>
                {parseInt(installments)} rate da <strong>{formatCurrency(installmentAmount)}</strong> cadauna
              </div>
            )}
          </div>
        )}

        {/* ONE_SHOT: nessuna configurazione aggiuntiva */}
        {type === "ONE_SHOT" && (
          <p className="text-sm" style={{ color: "#6b7280" }}>Verrà generata una singola fattura alla data di inizio.</p>
        )}
      </section>

      {/* Deposito */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Deposito / Acconto</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasDeposit} onChange={e => setHasDeposit(e.target.checked)} className="rounded border-gray-300" />
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
            hint={type === "INSTALLMENT" ? "Pagato prima dell'avvio delle rate" : "Pagato prima dell'avvio del servizio"}
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
