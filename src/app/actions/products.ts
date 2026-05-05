"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProduct(formData: FormData) {
  await prisma.product.create({
    data: {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      type: formData.get("type") as "SUBSCRIPTION" | "COACHING" | "CONSULTING" | "DIGITAL",
      basePrice: parseFloat(formData.get("basePrice") as string),
      active: formData.get("active") === "true",
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await prisma.product.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      type: formData.get("type") as "SUBSCRIPTION" | "COACHING" | "CONSULTING" | "DIGITAL",
      basePrice: parseFloat(formData.get("basePrice") as string),
      active: formData.get("active") === "true",
    },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect("/products");
}
