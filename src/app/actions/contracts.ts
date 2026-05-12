"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createContract(formData: FormData) {
  const type         = formData.get("type") as "RECURRING" | "ONE_SHOT";
  const depositAmount = formData.get("depositAmount") as string;
  const hasDeposit   = formData.get("hasDeposit") === "true";
  const installmentsRaw = formData.get("installments") as string;
  const installments = installmentsRaw && parseInt(installmentsRaw) > 1 ? parseInt(installmentsRaw) : null;

  const contract = await prisma.contract.create({
    data: {
      clientId:      formData.get("clientId") as string,
      productId:     formData.get("productId") as string,
      type,
      amount:        parseFloat(formData.get("amount") as string),
      startDate:     new Date(formData.get("startDate") as string),
      endDate:       formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      billingDay:    formData.get("billingDay") ? parseInt(formData.get("billingDay") as string) : 1,
      billingPeriod: (formData.get("billingPeriod") as "MONTHLY" | "QUARTERLY" | "ANNUALLY") || "MONTHLY",
      installments:  type === "ONE_SHOT" ? installments : null,
      notes:         (formData.get("notes") as string) || null,
      active:        true,
    },
  });

  if (hasDeposit && depositAmount) {
    await prisma.deposit.create({
      data: {
        contractId: contract.id,
        amount:     parseFloat(depositAmount),
        status:     "PENDING",
      },
    });
  }

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function updateContractStatus(id: string, active: boolean) {
  await prisma.contract.update({ where: { id }, data: { active } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
}

export async function markDepositPaid(
  depositId: string,
  contractId: string,
  formData: FormData,
) {
  const method = formData.get("method") as "STRIPE" | "PAYPAL" | "BANK_TRANSFER";
  const paidAt = new Date(formData.get("paidAt") as string);

  const deposit = await prisma.deposit.update({
    where: { id: depositId },
    data:  { status: "PAID", paidAt },
    include: { contract: { include: { client: true, product: true } } },
  });

  await prisma.payment.create({
    data: {
      depositId,
      amount:    deposit.amount,
      method,
      reference: (formData.get("reference") as string) || null,
      paidAt,
    },
  });

  // Genera fattura/acconto per il deposito
  const { contract } = deposit;
  const number = await nextInvoiceNumber();
  await prisma.invoice.create({
    data: {
      number,
      clientId:   contract.clientId,
      contractId: contract.id,
      amount:     deposit.amount,
      status:     "PAID",
      issueDate:  paidAt,
      dueDate:    paidAt,
      paidAt,
      notes:      "Acconto / deposito",
      lineItems:  [{ description: `Acconto — ${contract.product.name}`, quantity: 1, unitPrice: deposit.amount, total: deposit.amount }],
    },
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  revalidatePath("/invoices");
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const all  = await prisma.invoice.findMany({ select: { number: true } });
  let max = 0;
  for (const inv of all) {
    const match = inv.number.match(/^MYB-\d{4}-(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > max) max = n;
    }
  }
  return `MYB-${year}-${String(max + 1).padStart(4, "0")}`;
}
