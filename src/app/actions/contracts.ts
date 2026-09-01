"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendContractCreatedEmails } from "./email";
import { nextInvoiceNumber } from "@/lib/numbering";

export async function createContract(formData: FormData) {
  const type          = formData.get("type") as "RECURRING" | "ONE_SHOT" | "INSTALLMENT";
  const depositAmount = formData.get("depositAmount") as string;
  const hasDeposit    = formData.get("hasDeposit") === "true";
  const installmentsRaw = formData.get("installments") as string;

  // installments: solo per INSTALLMENT, deve essere >= 2
  const installments = type === "INSTALLMENT" && installmentsRaw && parseInt(installmentsRaw) >= 2
    ? parseInt(installmentsRaw)
    : null;

  // billingPeriod: non serve per ONE_SHOT
  const billingPeriod = type === "ONE_SHOT"
    ? "MONTHLY"
    : (formData.get("billingPeriod") as "MONTHLY" | "QUARTERLY" | "ANNUALLY") || "MONTHLY";

  const contract = await prisma.contract.create({
    data: {
      clientId:     formData.get("clientId") as string,
      productId:    formData.get("productId") as string,
      type,
      amount:       parseFloat(formData.get("amount") as string),
      startDate:    new Date(formData.get("startDate") as string),
      endDate:      formData.get("endDate") ? new Date(formData.get("endDate") as string) : null,
      billingDay:   formData.get("billingDay") ? parseInt(formData.get("billingDay") as string) : 1,
      billingPeriod,
      installments,
      notes:        (formData.get("notes") as string) || null,
      active:       true,
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

    // Genera subito la fattura DRAFT del deposito
    const product = await prisma.product.findUnique({
      where: { id: formData.get("productId") as string },
      select: { name: true },
    });
    const amt     = parseFloat(depositAmount);
    const today   = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 15);
    const number  = await nextInvoiceNumber();
    await prisma.invoice.create({
      data: {
        number,
        clientId:   contract.clientId,
        contractId: contract.id,
        amount:     amt,
        status:     "DRAFT",
        issueDate:  today,
        dueDate,
        notes:      "Acconto / deposito",
        lineItems:  [{ description: `Acconto — ${product?.name ?? "Servizio"}`, quantity: 1, unitPrice: amt, total: amt }],
      },
    });
  }

  try {
    const automation = await prisma.automation.findUnique({ where: { type: "CONTRACT_WELCOME" } });
    if (automation?.active) {
      await sendContractCreatedEmails(contract.id);
    }
  } catch (e) {
    console.error("Invio email nuovo contratto fallito", e);
  }

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function updateContractStatus(id: string, active: boolean) {
  await prisma.contract.update({ where: { id }, data: { active } });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
}

export async function deleteContract(id: string) {
  const paidCount = await prisma.invoice.count({
    where: { contractId: id, status: "PAID" },
  });
  if (paidCount > 0) {
    throw new Error("Non puoi eliminare un contratto con fatture già pagate.");
  }
  // Elimina prima le fatture bozza/annullate collegate
  await prisma.invoice.deleteMany({ where: { contractId: id } });
  await prisma.contract.delete({ where: { id } });
  revalidatePath("/contracts");
  redirect("/contracts");
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

  // Aggiorna o crea fattura deposito
  const { contract } = deposit;
  const existingDepositInvoice = await prisma.invoice.findFirst({
    where: { contractId: contract.id, notes: "Acconto / deposito" },
  });
  if (existingDepositInvoice) {
    await prisma.invoice.update({
      where: { id: existingDepositInvoice.id },
      data:  { status: "PAID", paidAt, issueDate: paidAt, dueDate: paidAt },
    });
  } else {
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
  }

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  revalidatePath("/invoices");
}

export async function generateNextInvoice(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      product: true,
      deposit:  true,
      invoices: {
        where:   { OR: [{ notes: null }, { notes: { not: "Acconto / deposito" } }], status: { not: "CANCELLED" } },
        orderBy: { issueDate: "asc" },
      },
    },
  });
  if (!contract) throw new Error("Contratto non trovato");
  if (!contract.active) throw new Error("Il contratto non è attivo");

  const invoiceCount = contract.invoices.length;
  if (contract.type === "ONE_SHOT" && invoiceCount >= 1) {
    throw new Error("Fattura già generata per questo contratto");
  }
  if (contract.type === "INSTALLMENT") {
    const n = contract.installments ?? 1;
    if (invoiceCount >= n) throw new Error("Tutte le rate sono già state generate");
  }

  const PERIOD_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12 };
  const months = PERIOD_MONTHS[contract.billingPeriod] ?? 1;
  const day    = contract.billingDay ?? 1;
  const start  = new Date(contract.startDate);
  const issueDate = new Date(start.getFullYear(), start.getMonth() + invoiceCount * months, day);

  const installmentAmount =
    contract.type === "INSTALLMENT"
      ? contract.amount / (contract.installments ?? 1)
      : contract.amount;

  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 15);

  const number = await nextInvoiceNumber();
  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId:   contract.clientId,
      contractId: contract.id,
      amount:     installmentAmount,
      status:     "DRAFT",
      issueDate,
      dueDate,
      lineItems: [
        {
          description: `${contract.product.name} — rata ${invoiceCount + 1}${contract.installments ? `/${contract.installments}` : ""}`,
          quantity:    1,
          unitPrice:   installmentAmount,
          total:       installmentAmount,
        },
      ],
    },
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

