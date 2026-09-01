"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";
import { ExpenseCategory } from "@prisma/client";

export const createExpense = companyAction(async (ctx, formData: FormData) => {
  await ctx.db.expense.create({
    data: {
      companyId:   ctx.companyId,
      date:        new Date(formData.get("date") as string),
      category:    formData.get("category") as ExpenseCategory,
      description: formData.get("description") as string,
      amount:      parseFloat(formData.get("amount") as string),
      vendor:      (formData.get("vendor") as string) || null,
      notes:       (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/${ctx.slug}/expenses`);
  revalidatePath(`/${ctx.slug}/dashboard`);
  redirect(`/${ctx.slug}/expenses`);
});

export const updateExpense = companyAction(async (ctx, id: string, formData: FormData) => {
  await ctx.db.expense.update({
    where: { id },
    data: {
      date:        new Date(formData.get("date") as string),
      category:    formData.get("category") as ExpenseCategory,
      description: formData.get("description") as string,
      amount:      parseFloat(formData.get("amount") as string),
      vendor:      (formData.get("vendor") as string) || null,
      notes:       (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/${ctx.slug}/expenses`);
  revalidatePath(`/${ctx.slug}/dashboard`);
  redirect(`/${ctx.slug}/expenses`);
});

export const deleteExpense = companyAction(async (ctx, id: string) => {
  await ctx.db.expense.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/expenses`);
  revalidatePath(`/${ctx.slug}/dashboard`);
  redirect(`/${ctx.slug}/expenses`);
});
