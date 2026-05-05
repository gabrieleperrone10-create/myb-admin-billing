"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createContract(formData: FormData) {
  const type = formData.get("type") as "RECURRING" | "ONE_SHOT";
  const depositAmount = formData.get("depositAmount") as string;
  const hasDeposit = formData.get("hasDeposit") === "true";

  const contract = await prisma.contract.create({
    data: {
      clientId: formData.get("clientId") as string,
      productId: formData.get("productId") as string,
      type,
      amount: parseFloat(formData.get("amount") as string),
      startDate: new Date(formData.get("startDate") as string),
      endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      billingDay: type === "RECURRING" && formData.get("billingDay")
        ? parseInt(formData.get("billingDay") as string)
        : null,
      notes: (formData.get("notes") as string) || null,
      active: true,
    },
  });

  if (hasDeposit && depositAmount) {
    await prisma.deposit.create({
      data: {
        contractId: contract.id,
        amount: parseFloat(depositAmount),
        status: "PENDING",
      },
    });
  }

  revalidatePath("/contracts");
  redirect("/contracts");
}

export async function updateContractStatus(id: string, active: boolean) {
  await prisma.contract.update({ where: { id }, data: { active } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
}
