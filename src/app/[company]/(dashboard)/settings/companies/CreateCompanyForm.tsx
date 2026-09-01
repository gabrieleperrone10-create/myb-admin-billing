"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createCompany } from "@/app/actions/companies";
import { AlertCircle } from "lucide-react";

export default function CreateCompanyForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const action = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await createCompany(formData);
      // Se arriva qui la creazione e' fallita: il caso di successo termina
      // con redirect() lato server, che non torna mai un valore al client.
      if (result) setError(result.error);
    });
  };

  return (
    <form action={action} className="space-y-4 max-w-sm">
      <Input label="Nome azienda" name="name" required placeholder="Axis Mundi" />
      <Input
        label="Indirizzo URL (opzionale)"
        name="slug"
        placeholder="derivato automaticamente dal nome"
        hint="Comparirà come /questo-indirizzo/... in ogni pagina"
      />
      <Input
        label="Prefisso numerazione documenti"
        name="invoicePrefix"
        placeholder="es. AXM"
        hint="Le fatture di questa azienda saranno AXM-2026-0001, ecc. — separato da quello delle altre aziende"
      />

      {error && (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "#dc2626" }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" loading={pending}>Crea azienda</Button>
    </form>
  );
}
