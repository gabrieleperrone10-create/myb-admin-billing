"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";

/**
 * File di riferimento per la conversione delle server action.
 *
 * Ogni action e' avvolta in companyAction(): riceve lo slug come primo argomento
 * (dal chiamante, quindi non fidato) e in cambio ha un ctx con la membership gia'
 * verificata e un client db filtrato sull'azienda.
 *
 * Lato chiamante:  <form action={createClient.bind(null, slug)}>
 */

const clientFields = (formData: FormData) => ({
  name:       formData.get("name") as string,
  email:      formData.get("email") as string,
  phone:      (formData.get("phone") as string) || null,
  whatsapp:   (formData.get("whatsapp") as string) || null,
  company:    (formData.get("company") as string) || null,
  fiscalCode: (formData.get("fiscalCode") as string) || null,
  vatNumber:  (formData.get("vatNumber") as string) || null,
  address:    (formData.get("address") as string) || null,
  city:       (formData.get("city") as string) || null,
  zip:        (formData.get("zip") as string) || null,
  province:   (formData.get("province") as string) || null,
  country:    (formData.get("country") as string) || null,
  notes:      (formData.get("notes") as string) || null,
});

export const createClient = companyAction(async (ctx, formData: FormData) => {
  await ctx.db.client.create({
    data: { companyId: ctx.companyId, ...clientFields(formData) },
  });

  revalidatePath(`/${ctx.slug}/clients`);
  redirect(`/${ctx.slug}/clients`);
});

export const updateClient = companyAction(async (ctx, id: string, formData: FormData) => {
  // il where lo completa l'estensione con companyId: un id di un'altra azienda
  // non trova nulla invece di aggiornare
  await ctx.db.client.update({ where: { id }, data: clientFields(formData) });

  revalidatePath(`/${ctx.slug}/clients`);
  revalidatePath(`/${ctx.slug}/clients/${id}`);
  redirect(`/${ctx.slug}/clients`);
});

export const deleteClient = companyAction(async (ctx, id: string) => {
  await ctx.db.client.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/clients`);
  redirect(`/${ctx.slug}/clients`);
});
