"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getCompanySettings() {
  return prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function saveCompanySettings(formData: FormData) {
  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {
      name: formData.get("name") as string,
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
    create: {
      id: "singleton",
      name: formData.get("name") as string,
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

  revalidatePath("/settings");
}
