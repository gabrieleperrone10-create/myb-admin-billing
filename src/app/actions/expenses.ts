"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ExpenseCategory } from "@prisma/client";

export async function createExpense(formData: FormData) {
  await prisma.expense.create({
    data: {
      date:        new Date(formData.get("date") as string),
      category:    formData.get("category") as ExpenseCategory,
      description: formData.get("description") as string,
      amount:      parseFloat(formData.get("amount") as string),
      vendor:      (formData.get("vendor") as string) || null,
      notes:       (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/expenses");
}

export async function updateExpense(id: string, formData: FormData) {
  await prisma.expense.update({
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

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/expenses");
}

export async function deleteExpense(id: string) {
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/expenses");
}
