"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClient(formData: FormData) {
  const email = formData.get("email") as string;

  await prisma.client.create({
    data: {
      name: formData.get("name") as string,
      email,
      phone: (formData.get("phone") as string) || null,
      whatsapp: (formData.get("whatsapp") as string) || null,
      company: (formData.get("company") as string) || null,
      fiscalCode: (formData.get("fiscalCode") as string) || null,
      vatNumber: (formData.get("vatNumber") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      zip: (formData.get("zip") as string) || null,
      province: (formData.get("province") as string) || null,
      country: (formData.get("country") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(id: string, formData: FormData) {
  await prisma.client.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      whatsapp: (formData.get("whatsapp") as string) || null,
      company: (formData.get("company") as string) || null,
      fiscalCode: (formData.get("fiscalCode") as string) || null,
      vatNumber: (formData.get("vatNumber") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      zip: (formData.get("zip") as string) || null,
      province: (formData.get("province") as string) || null,
      country: (formData.get("country") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect("/clients");
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}
