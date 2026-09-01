"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createProduct, updateProduct } from "@/app/actions/products";
import type { Product } from "@prisma/client";

const TYPE_OPTIONS = [
  { value: "SUBSCRIPTION", label: "Abbonamento" },
  { value: "COACHING", label: "Coaching" },
  { value: "CONSULTING", label: "Consulenza" },
  { value: "DIGITAL", label: "Prodotto Digitale" },
];

interface Props { product?: Product }

export default function ProductForm({ product }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const action = (formData: FormData) => {
    startTransition(async () => {
      if (product) await updateProduct(product.id, formData);
      else await createProduct(formData);
    });
  };

  return (
    <form action={action} className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input label="Nome prodotto / servizio" name="name" required placeholder="Percorso Business 1:1" defaultValue={product?.name} />
          <Select label="Tipo" name="type" required options={TYPE_OPTIONS} placeholder="Seleziona tipo..." defaultValue={product?.type} />
          <Input label="Prezzo base (EUR)" name="basePrice" type="number" step="0.01" min="0" required placeholder="0.00" defaultValue={product?.basePrice?.toString()} />
          <Select
            label="Stato"
            name="active"
            options={[{ value: "true", label: "Attivo" }, { value: "false", label: "Non attivo" }]}
            defaultValue={product ? String(product.active) : "true"}
          />
          <div className="md:col-span-2">
            <Textarea label="Descrizione" name="description" placeholder="Descrizione del prodotto..." defaultValue={product?.description ?? ""} />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>{product ? "Salva modifiche" : "Crea prodotto"}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Annulla</Button>
      </div>
    </form>
  );
}
