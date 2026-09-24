"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";
import { upsertContact, setLifecycle } from "@/lib/crm/contacts";
import { logActivity } from "@/lib/crm/activity";

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
  const fields = clientFields(formData);
  const client = await ctx.db.client.create({
    data: { companyId: ctx.companyId, ...fields },
  });

  // Ogni cliente di fatturazione ha il suo contatto CRM (lista Lead/Clienti).
  // Se esiste gia' un lead con la stessa email/telefono lo si collega invece
  // di duplicarlo. Un errore qui non deve impedire la creazione del cliente.
  try {
    const [firstName, ...rest] = fields.name.trim().split(/\s+/);
    const { contact } = await upsertContact(ctx.db, ctx.companyId, {
      email: fields.email, phone: fields.phone, whatsapp: fields.whatsapp,
      firstName, lastName: rest.join(" ") || null, companyName: fields.company, source: "billing",
    }, { actorUserId: ctx.userId });
    const linked = await ctx.db.client.findFirst({ where: { contactId: contact.id }, select: { id: true } });
    if (!linked) {
      await ctx.db.client.update({ where: { id: client.id }, data: { contactId: contact.id } });
      await logActivity(ctx.db, ctx.companyId, { contactId: contact.id, type: "CLIENT_LINKED", data: { clientId: client.id }, actorUserId: ctx.userId });
    }
    await setLifecycle(ctx.db, ctx.companyId, contact.id, "CUSTOMER", ctx.userId);
  } catch (e) {
    console.error("[clients] collegamento contatto CRM fallito", e);
  }

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
