"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { companyAction } from "@/lib/companyAction";
import { requireCompany } from "@/lib/company";

/**
 * Company non e' un modello "tenant": e' l'azienda stessa, quindi l'estensione
 * non ci tocca il where (non e' nell'elenco TENANT_MODELS in src/lib/db.ts).
 * L'isolamento qui lo fa requireCompany(): senza membership non si arriva nemmeno
 * a leggere ctx.company.
 */

export async function getCompanySettings(slug: string) {
  const ctx = await requireCompany(slug);
  return ctx.company;
}

export const saveCompanySettings = companyAction(async (ctx, formData: FormData) => {
  await ctx.db.company.update({
    where: { id: ctx.companyId },
    data: {
      name: formData.get("name") as string,
      brandName: (formData.get("brandName") as string) || null,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      website: (formData.get("website") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      zip: (formData.get("zip") as string) || null,
      province: (formData.get("province") as string) || null,
      country: (formData.get("country") as string) || null,
      vatNumber: (formData.get("vatNumber") as string) || null,
      fiscalCode: (formData.get("fiscalCode") as string) || null,
      bankName: (formData.get("bankName") as string) || null,
      iban: (formData.get("iban") as string) || null,
      bic: (formData.get("bic") as string) || null,
      invoiceFooter: (formData.get("invoiceFooter") as string) || null,
    },
  });

  revalidatePath(`/${ctx.slug}/settings`);
});

export const uploadCompanyLogo = companyAction(async (ctx, formData: FormData) => {
  const file = formData.get("file") as File;
  const blob = await put(`company-logo/${ctx.companyId}/${file.name}`, file, { access: "public" });

  if (ctx.company.logoUrl) { try { await del(ctx.company.logoUrl); } catch {} }

  await ctx.db.company.update({ where: { id: ctx.companyId }, data: { logoUrl: blob.url } });
  revalidatePath(`/${ctx.slug}/settings`);
  return blob.url;
});

export const removeCompanyLogo = companyAction(async (ctx) => {
  if (ctx.company.logoUrl) { try { await del(ctx.company.logoUrl); } catch {} }
  await ctx.db.company.update({ where: { id: ctx.companyId }, data: { logoUrl: null } });
  revalidatePath(`/${ctx.slug}/settings`);
});

export const updateBankBalance = companyAction(async (ctx, amount: number) => {
  await ctx.db.company.update({
    where: { id: ctx.companyId },
    data: { bankBalance: amount, bankBalanceAt: new Date() },
  });
  revalidatePath(`/${ctx.slug}/dashboard`);
});
