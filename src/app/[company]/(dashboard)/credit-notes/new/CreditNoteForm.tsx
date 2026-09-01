"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createManualCreditNote } from "@/app/actions/creditNotes";
import { useCompanySlug } from "@/lib/useCompany";

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string;
  vatNumber: string | null;
  fiscalCode: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
}

interface Props {
  clients: Client[];
}

const emptyClient = {
  clientId: "",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  clientVatNumber: "",
  clientFiscalCode: "",
  clientAddress: "",
  clientCity: "",
  clientZip: "",
  clientProvince: "",
  clientCountry: "",
};

export default function CreditNoteForm({ clients }: Props) {
  const slug = useCompanySlug();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState(emptyClient);
  const router = useRouter();

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.company ? `${c.name} — ${c.company}` : c.name,
  }));

  const handleSelectClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) {
      setFields((f) => ({ ...f, clientId: "" }));
      return;
    }
    setFields({
      clientId: client.id,
      clientName: client.name,
      clientCompany: client.company ?? "",
      clientEmail: client.email ?? "",
      clientVatNumber: client.vatNumber ?? "",
      clientFiscalCode: client.fiscalCode ?? "",
      clientAddress: client.address ?? "",
      clientCity: client.city ?? "",
      clientZip: client.zip ?? "",
      clientProvince: client.province ?? "",
      clientCountry: client.country ?? "",
    });
  };

  const updateField = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
  };

  const action = (formData: FormData) => {
    startTransition(async () => { await createManualCreditNote(slug, formData); });
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="clientId" value={fields.clientId} />

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Cliente</h2>
        <div className="space-y-1">
          <Select
            label="Seleziona da anagrafica (opzionale)"
            options={clientOptions}
            placeholder="Cliente non presente in anagrafica..."
            value={fields.clientId}
            onChange={(e) => handleSelectClient(e.target.value)}
          />
          <p className="text-[11px] text-gray-400">
            Se il cliente esiste già, selezionalo per precompilare i campi sotto. Restano comunque modificabili.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Nome / Ragione sociale" name="clientName" required value={fields.clientName} onChange={updateField("clientName")} />
          <Input label="Azienda (opzionale)" name="clientCompany" value={fields.clientCompany} onChange={updateField("clientCompany")} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Email" name="clientEmail" type="email" value={fields.clientEmail} onChange={updateField("clientEmail")} hint="Necessaria per inviare la nota di credito via email" />
          <Input label="P.IVA" name="clientVatNumber" value={fields.clientVatNumber} onChange={updateField("clientVatNumber")} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Codice fiscale" name="clientFiscalCode" value={fields.clientFiscalCode} onChange={updateField("clientFiscalCode")} />
          <Input label="Indirizzo" name="clientAddress" value={fields.clientAddress} onChange={updateField("clientAddress")} />
        </div>
        <div className="grid grid-cols-3 gap-5">
          <Input label="Città" name="clientCity" value={fields.clientCity} onChange={updateField("clientCity")} />
          <Input label="CAP" name="clientZip" value={fields.clientZip} onChange={updateField("clientZip")} />
          <Input label="Provincia" name="clientProvince" value={fields.clientProvince} onChange={updateField("clientProvince")} />
        </div>
        <Input label="Paese" name="clientCountry" value={fields.clientCountry} onChange={updateField("clientCountry")} />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Fattura originale</h2>
        <p className="text-sm text-gray-500">
          Per fatture vecchie non presenti nel gestionale, inserisci qui i riferimenti manualmente.
        </p>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Numero fattura" name="originalInvoiceNumber" required placeholder="es. 2023/045" />
          <Input label="Data fattura" name="originalInvoiceDate" type="date" />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Dettagli nota di credito</h2>
        <div className="grid grid-cols-2 gap-5">
          <Input label="Importo" name="amount" type="number" step="0.01" min="0" required />
          <Input label="Valuta" name="currency" defaultValue="EUR" />
        </div>
        <Input label="Data emissione" name="issueDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
        <Textarea label="Motivo" name="reason" required placeholder="es. Errore di fatturazione, storno totale fattura..." />
        <Textarea label="Note (opzionale)" name="notes" placeholder="Note aggiuntive da includere nel documento..." />
      </section>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Genera nota di credito</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annulla</Button>
      </div>
    </form>
  );
}
