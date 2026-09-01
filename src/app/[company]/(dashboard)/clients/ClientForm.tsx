"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createClient, updateClient } from "@/app/actions/clients";
import type { Client } from "@prisma/client";

const COUNTRIES = [
  "Italia", "Francia", "Germania", "Spagna", "Regno Unito", "Svizzera",
  "Stati Uniti", "Canada", "Australia", "Altro",
].map((c) => ({ value: c, label: c }));

interface Props {
  client?: Client;
}

export default function ClientForm({ client }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const action = (formData: FormData) => {
    startTransition(async () => {
      if (client) await updateClient(client.id, formData);
      else await createClient(formData);
    });
  };

  return (
    <form action={action} className="space-y-8">
      {/* Dati personali */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Dati personali</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Nome completo"
            name="name"
            required
            placeholder="Mario Rossi"
            defaultValue={client?.name}
          />
          <Input
            label="Azienda / Ragione sociale"
            name="company"
            placeholder="Acme SRL"
            defaultValue={client?.company ?? ""}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            required
            placeholder="mario@azienda.com"
            defaultValue={client?.email}
          />
          <Input
            label="Telefono"
            name="phone"
            type="tel"
            placeholder="+39 333 1234567"
            defaultValue={client?.phone ?? ""}
            hint="Usato anche per le chiamate"
          />
          <Input
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            placeholder="+39 333 1234567"
            defaultValue={client?.whatsapp ?? ""}
            hint="Per i promemoria automatici via WhatsApp"
          />
        </div>
      </section>

      {/* Dati fiscali */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Dati fiscali</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Partita IVA"
            name="vatNumber"
            placeholder="IT12345678901"
            defaultValue={client?.vatNumber ?? ""}
          />
          <Input
            label="Codice Fiscale"
            name="fiscalCode"
            placeholder="RSSMRA80A01H501Z"
            defaultValue={client?.fiscalCode ?? ""}
          />
        </div>
      </section>

      {/* Indirizzo */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Indirizzo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Input
              label="Via / Indirizzo"
              name="address"
              placeholder="Via Roma 1"
              defaultValue={client?.address ?? ""}
            />
          </div>
          <Input
            label="Città"
            name="city"
            placeholder="Milano"
            defaultValue={client?.city ?? ""}
          />
          <Input
            label="CAP"
            name="zip"
            placeholder="20100"
            defaultValue={client?.zip ?? ""}
          />
          <Input
            label="Provincia"
            name="province"
            placeholder="MI"
            defaultValue={client?.province ?? ""}
          />
          <Select
            label="Paese"
            name="country"
            options={COUNTRIES}
            placeholder="Seleziona paese..."
            defaultValue={client?.country ?? ""}
          />
        </div>
      </section>

      {/* Note */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Note interne</h2>
        <Textarea
          label="Note"
          name="notes"
          placeholder="Informazioni aggiuntive sul cliente..."
          defaultValue={client?.notes ?? ""}
        />
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {client ? "Salva modifiche" : "Crea cliente"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
