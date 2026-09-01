"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";

export const createProduct = companyAction(async (ctx, formData: FormData) => {
  await ctx.db.product.create({
    data: {
      companyId: ctx.companyId,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      type: formData.get("type") as "SUBSCRIPTION" | "COACHING" | "CONSULTING" | "DIGITAL",
      basePrice: parseFloat(formData.get("basePrice") as string),
      active: formData.get("active") === "true",
    },
  });

  revalidatePath(`/${ctx.slug}/products`);
  redirect(`/${ctx.slug}/products`);
});

export const updateProduct = companyAction(async (ctx, id: string, formData: FormData) => {
  await ctx.db.product.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      type: formData.get("type") as "SUBSCRIPTION" | "COACHING" | "CONSULTING" | "DIGITAL",
      basePrice: parseFloat(formData.get("basePrice") as string),
      active: formData.get("active") === "true",
    },
  });

  revalidatePath(`/${ctx.slug}/products`);
  revalidatePath(`/${ctx.slug}/products/${id}`);
  redirect(`/${ctx.slug}/products`);
});
