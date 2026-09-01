"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";
import { nextCreditNoteNumber } from "@/lib/numbering";

export const createCreditNoteFromInvoice = companyAction(async (ctx, invoiceId: string, formData: FormData) => {
  const invoice = await ctx.db.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!invoice) throw new Error("Fattura non trovata");

  const amountRaw = formData.get("amount") as string;
  const amount = amountRaw ? parseFloat(amountRaw) : invoice.amount;
  const reason = (formData.get("reason") as string) || "";

  const number = await nextCreditNoteNumber(ctx.db, ctx.companyId, ctx.company.creditNotePrefix, ctx.company.numberPadding);
  const lineItems = [{
    description: `Storno fattura ${invoice.number}${reason ? " — " + reason : ""}`,
    quantity: 1,
    unitPrice: amount,
    total: amount,
  }];

  const creditNote = await ctx.db.creditNote.create({
    data: {
      companyId: ctx.companyId,
      number,
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      clientName: invoice.client.name,
      clientCompany: invoice.client.company,
      clientEmail: invoice.client.email,
      clientVatNumber: invoice.client.vatNumber,
      clientFiscalCode: invoice.client.fiscalCode,
      clientAddress: invoice.client.address,
      clientCity: invoice.client.city,
      clientZip: invoice.client.zip,
      clientProvince: invoice.client.province,
      clientCountry: invoice.client.country,
      originalInvoiceNumber: invoice.number,
      originalInvoiceDate: invoice.issueDate,
      amount,
      currency: invoice.currency,
      reason,
      lineItems,
    },
  });

  revalidatePath(`/${ctx.slug}/credit-notes`);
  revalidatePath(`/${ctx.slug}/invoices/${invoiceId}`);
  redirect(`/${ctx.slug}/credit-notes/${creditNote.id}`);
});

export const createManualCreditNote = companyAction(async (ctx, formData: FormData) => {
  const amount = parseFloat(formData.get("amount") as string);
  const reason = (formData.get("reason") as string) || "";
  const originalInvoiceNumber = formData.get("originalInvoiceNumber") as string;
  const originalInvoiceDateRaw = formData.get("originalInvoiceDate") as string | null;
  const issueDateRaw = formData.get("issueDate") as string | null;

  const number = await nextCreditNoteNumber(ctx.db, ctx.companyId, ctx.company.creditNotePrefix, ctx.company.numberPadding);
  const lineItems = [{
    description: `Storno fattura ${originalInvoiceNumber}${reason ? " — " + reason : ""}`,
    quantity: 1,
    unitPrice: amount,
    total: amount,
  }];

  const creditNote = await ctx.db.creditNote.create({
    data: {
      companyId: ctx.companyId,
      number,
      clientId: (formData.get("clientId") as string) || null,
      clientName: formData.get("clientName") as string,
      clientCompany: (formData.get("clientCompany") as string) || null,
      clientEmail: (formData.get("clientEmail") as string) || null,
      clientVatNumber: (formData.get("clientVatNumber") as string) || null,
      clientFiscalCode: (formData.get("clientFiscalCode") as string) || null,
      clientAddress: (formData.get("clientAddress") as string) || null,
      clientCity: (formData.get("clientCity") as string) || null,
      clientZip: (formData.get("clientZip") as string) || null,
      clientProvince: (formData.get("clientProvince") as string) || null,
      clientCountry: (formData.get("clientCountry") as string) || null,
      originalInvoiceNumber,
      originalInvoiceDate: originalInvoiceDateRaw ? new Date(originalInvoiceDateRaw) : null,
      amount,
      currency: (formData.get("currency") as string) || "EUR",
      reason,
      lineItems,
      issueDate: issueDateRaw ? new Date(issueDateRaw) : new Date(),
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath(`/${ctx.slug}/credit-notes`);
  redirect(`/${ctx.slug}/credit-notes/${creditNote.id}`);
});

export const updateCreditNoteStatus = companyAction(async (ctx, id: string, status: "CANCELLED") => {
  await ctx.db.creditNote.update({ where: { id }, data: { status } });
  revalidatePath(`/${ctx.slug}/credit-notes`);
  revalidatePath(`/${ctx.slug}/credit-notes/${id}`);
});

export const deleteCreditNote = companyAction(async (ctx, id: string) => {
  const creditNote = await ctx.db.creditNote.findUnique({ where: { id }, select: { status: true } });
  if (!creditNote) return;
  if (creditNote.status === "SENT") {
    throw new Error("Non è possibile eliminare una nota di credito già inviata al cliente.");
  }
  await ctx.db.creditNote.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/credit-notes`);
  redirect(`/${ctx.slug}/credit-notes`);
});
