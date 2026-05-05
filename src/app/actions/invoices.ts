"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function nextInvoiceNumber() {
  const last = await prisma.invoice.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } });
  const year = new Date().getFullYear();
  if (!last) return `MYB-${year}-0001`;
  const parts = last.number.split("-");
  const seq = parseInt(parts[parts.length - 1]) + 1;
  return `MYB-${year}-${String(seq).padStart(4, "0")}`;
}

export async function createInvoice(formData: FormData) {
  const lineItemsRaw = formData.get("lineItems") as string;
  const lineItems = JSON.parse(lineItemsRaw);
  const amount = lineItems.reduce((s: number, li: { total: number }) => s + li.total, 0);
  const number = await nextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: formData.get("clientId") as string,
      contractId: (formData.get("contractId") as string) || null,
      amount,
      status: "DRAFT",
      issueDate: new Date(formData.get("issueDate") as string),
      dueDate: new Date(formData.get("dueDate") as string),
      notes: (formData.get("notes") as string) || null,
      lineItems,
    },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function markInvoicePaid(invoiceId: string, formData: FormData) {
  const method = formData.get("method") as "STRIPE" | "PAYPAL" | "BANK_TRANSFER";
  const paidAt = new Date(formData.get("paidAt") as string);

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt },
    }),
    prisma.payment.create({
      data: {
        invoiceId,
        amount: parseFloat(formData.get("amount") as string),
        method,
        reference: (formData.get("reference") as string) || null,
        stripePaymentId: (formData.get("stripePaymentId") as string) || null,
        paypalOrderId: (formData.get("paypalOrderId") as string) || null,
        paidAt,
        notes: (formData.get("notes") as string) || null,
      },
    }),
  ]);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  revalidatePath("/payments");
}

export async function updateInvoiceStatus(id: string, status: "SENT" | "OVERDUE" | "CANCELLED") {
  const data: Record<string, unknown> = { status };
  if (status === "SENT") data.sentAt = new Date();
  await prisma.invoice.update({ where: { id }, data });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}
