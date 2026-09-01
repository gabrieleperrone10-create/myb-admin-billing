"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";
import { nextInvoiceNumber } from "@/lib/numbering";

export const createInvoice = companyAction(async (ctx, formData: FormData) => {
  const lineItems = JSON.parse(formData.get("lineItems") as string);
  const amount = lineItems.reduce((s: number, li: { total: number }) => s + li.total, 0);

  const number = await nextInvoiceNumber(
    ctx.db, ctx.companyId, ctx.company.invoicePrefix, ctx.company.numberPadding,
  );

  const statusRaw = (formData.get("status") as string) || "DRAFT";
  const paidAtRaw = formData.get("paidAt") as string | null;
  const isPaid = statusRaw === "PAID";

  const invoice = await ctx.db.invoice.create({
    data: {
      companyId:  ctx.companyId,
      number,
      clientId:   formData.get("clientId") as string,
      contractId: (formData.get("contractId") as string) || null,
      amount,
      status:     statusRaw as "DRAFT" | "SENT" | "PAID",
      issueDate:  new Date(formData.get("issueDate") as string),
      dueDate:    new Date(formData.get("dueDate") as string),
      paidAt:     isPaid && paidAtRaw ? new Date(paidAtRaw) : null,
      sentAt:     (statusRaw === "SENT" || isPaid) ? new Date() : null,
      notes:      (formData.get("notes") as string) || null,
      lineItems,
    },
  });

  revalidatePath(`/${ctx.slug}/invoices`);
  redirect(`/${ctx.slug}/invoices/${invoice.id}`);
});

export const markInvoicePaid = companyAction(async (ctx, invoiceId: string, formData: FormData) => {
  const method = formData.get("method") as "STRIPE" | "PAYPAL" | "BANK_TRANSFER";
  const paidAt = new Date(formData.get("paidAt") as string);

  // La fattura va verificata prima: senza questo controllo un id di un'altra
  // azienda creerebbe comunque il Payment, che non ha modo di accorgersene.
  const invoice = await ctx.db.invoice.findUnique({
    where: { id: invoiceId }, select: { id: true },
  });
  if (!invoice) throw new Error("Fattura non trovata.");

  await ctx.db.$transaction([
    ctx.db.invoice.update({
      where: { id: invoiceId },
      data:  { status: "PAID", paidAt },
    }),
    ctx.db.payment.create({
      data: {
        companyId:       ctx.companyId,
        invoiceId,
        amount:          parseFloat(formData.get("amount") as string),
        method,
        reference:       (formData.get("reference") as string) || null,
        stripePaymentId: (formData.get("stripePaymentId") as string) || null,
        paypalOrderId:   (formData.get("paypalOrderId") as string) || null,
        paidAt,
        notes:           (formData.get("notes") as string) || null,
      },
    }),
  ]);

  revalidatePath(`/${ctx.slug}/invoices`);
  revalidatePath(`/${ctx.slug}/invoices/${invoiceId}`);
  revalidatePath(`/${ctx.slug}/dashboard`);
  revalidatePath(`/${ctx.slug}/payments`);
});

export const updateInvoiceStatus = companyAction(
  async (ctx, id: string, status: "SENT" | "OVERDUE" | "CANCELLED") => {
    const data: Record<string, unknown> = { status };
    if (status === "SENT") data.sentAt = new Date();

    await ctx.db.invoice.update({ where: { id }, data });

    revalidatePath(`/${ctx.slug}/invoices`);
    revalidatePath(`/${ctx.slug}/invoices/${id}`);
  },
);

export const deleteInvoice = companyAction(async (ctx, id: string) => {
  const invoice = await ctx.db.invoice.findUnique({
    where: { id }, select: { status: true },
  });
  if (!invoice) throw new Error("Fattura non trovata.");

  if (invoice.status !== "DRAFT" && invoice.status !== "CANCELLED") {
    throw new Error("Solo le fatture in bozza o annullate possono essere eliminate.");
  }

  await ctx.db.invoice.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/invoices`);
  redirect(`/${ctx.slug}/invoices`);
});
