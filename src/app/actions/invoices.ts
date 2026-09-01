"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextInvoiceNumber } from "@/lib/numbering";


export async function createInvoice(formData: FormData) {
  const lineItemsRaw = formData.get("lineItems") as string;
  const lineItems = JSON.parse(lineItemsRaw);
  const amount = lineItems.reduce((s: number, li: { total: number }) => s + li.total, 0);
  const number = await nextInvoiceNumber();

  const statusRaw = (formData.get("status") as string) || "DRAFT";
  const paidAtRaw = formData.get("paidAt") as string | null;
  const isPaid = statusRaw === "PAID";

  const invoice = await prisma.invoice.create({
    data: {
      number,
      clientId: formData.get("clientId") as string,
      contractId: (formData.get("contractId") as string) || null,
      amount,
      status: statusRaw as "DRAFT" | "SENT" | "PAID",
      issueDate: new Date(formData.get("issueDate") as string),
      dueDate: new Date(formData.get("dueDate") as string),
      paidAt: isPaid && paidAtRaw ? new Date(paidAtRaw) : null,
      sentAt: (statusRaw === "SENT" || isPaid) ? new Date() : null,
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

export async function deleteInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { status: true, number: true } });
  if (!invoice) return;
  // Cleanup mirato duplicati: consenti la cancellazione dei duplicati noti anche se "Pagata".
  const isDeletableDuplicate = invoice.number === "MYB-2026-0014" || invoice.number === "MYB-2026-0015";
  if (invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && !isDeletableDuplicate) {
    throw new Error("Solo le fatture in bozza o annullate possono essere eliminate.");
  }
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/invoices");
  redirect("/invoices");
}
