"use server";

import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvoiceEmail(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!invoice) return { ok: false, error: "Fattura non trovata" };
  if (!invoice.client.email) return { ok: false, error: "Il cliente non ha un indirizzo email" };

  const lineItems = invoice.lineItems as {
    description: string; quantity: number; unitPrice: number; total: number;
  }[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDF as any, {
    invoice: {
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      status: invoice.status,
      notes: invoice.notes,
      amount: invoice.amount,
      lineItems,
      client: {
        name: invoice.client.name,
        company: invoice.client.company,
        email: invoice.client.email,
        vatNumber: invoice.client.vatNumber,
        fiscalCode: invoice.client.fiscalCode,
        address: invoice.client.address,
        city: invoice.client.city,
        zip: invoice.client.zip,
        province: invoice.client.province,
        country: invoice.client.country,
      },
    },
    company: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      website: company.website,
      vatNumber: company.vatNumber,
      fiscalCode: company.fiscalCode,
      address: company.address,
      city: company.city,
      zip: company.zip,
      province: company.province,
      country: company.country,
      bankName: company.bankName,
      iban: company.iban,
      bic: company.bic,
      invoiceFooter: company.invoiceFooter,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const pdfBuffer = await renderToBuffer(element);

  const fromName = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";
  const isPaid = invoice.status === "PAID";
  const isOverdue = invoice.status === "OVERDUE";
  const dueDate = new Intl.DateTimeFormat("it-IT").format(new Date(invoice.dueDate));
  const paidDate = invoice.paidAt ? new Intl.DateTimeFormat("it-IT").format(new Date(invoice.paidAt)) : null;
  const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(invoice.amount);

  // Contenuto adattato allo stato della fattura
  const accentColor = isPaid ? "#16a34a" : isOverdue ? "#dc2626" : "#2563eb";
  const badgeText = isPaid ? "✅ PAGATA" : isOverdue ? "⚠️ SCADUTA" : "📄 DA PAGARE";
  const badgeBg = isPaid ? "#f0fdf4" : isOverdue ? "#fef2f2" : "#eff6ff";

  const bodyText = isPaid
    ? `ti confermiamo la ricezione del pagamento per la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong>${paidDate ? `, registrato in data <strong>${paidDate}</strong>` : ""}. Trovi il documento in allegato per i tuoi archivi.`
    : isOverdue
    ? `ti ricordiamo che la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong> risulta <strong>scaduta il ${dueDate}</strong> e non è ancora stata saldata. Ti chiediamo di provvedere al pagamento il prima possibile.`
    : `ti inviamo in allegato la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong>, con scadenza il <strong>${dueDate}</strong>. Ti chiediamo di procedere al pagamento entro la data indicata.`;

  const showBankDetails = !isPaid && company.iban;

  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 32px 16px;">

      <div style="border-bottom: 3px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 20px; font-weight: 700; color: ${accentColor};">${fromName}</span>
      </div>

      <div style="background: ${badgeBg}; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; display: inline-block;">
        <span style="font-size: 13px; font-weight: 600; color: ${accentColor};">${badgeText} — ${invoice.number}</span>
      </div>

      <p style="font-size: 16px; margin-bottom: 8px;">Gentile ${invoice.client.name},</p>
      <p style="color: #4b5563; line-height: 1.6;">${bodyText}</p>

      ${showBankDetails ? `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="font-size: 12px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;">Coordinate bancarie per il pagamento</p>
        ${company.bankName ? `<p style="margin: 4px 0; font-size: 14px; color: #374151;">Banca: <strong>${company.bankName}</strong></p>` : ""}
        <p style="margin: 4px 0; font-size: 14px; color: #374151;">IBAN: <strong>${company.iban}</strong></p>
        ${company.bic ? `<p style="margin: 4px 0; font-size: 14px; color: #374151;">BIC/SWIFT: <strong>${company.bic}</strong></p>` : ""}
        <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Causale consigliata: ${invoice.number}</p>
      </div>
      ` : ""}

      <p style="color: #4b5563; line-height: 1.6; margin-top: 20px;">
        Per qualsiasi domanda o necessità di assistenza, rispondi direttamente a questa email
        o scrivici a <a href="mailto:${replyTo}" style="color: ${accentColor};">${replyTo}</a>.
      </p>

      <p style="color: #4b5563; margin-top: 20px;">Grazie,<br><strong>${fromName}</strong></p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 11px; color: #9ca3af;">
        ${company.email}${company.phone ? ` · ${company.phone}` : ""}${company.website ? ` · ${company.website}` : ""}
      </p>
    </body>
    </html>
  `;

  try {
    const subject = isPaid
      ? `Ricevuta pagamento ${invoice.number} — ${amount}`
      : isOverdue
      ? `⚠️ Sollecito pagamento ${invoice.number} — ${amount}`
      : `Fattura ${invoice.number} — ${amount}`;

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      replyTo: replyTo,
      to: [invoice.client.email],
      subject,
      html,
      attachments: [
        {
          filename: `${invoice.number}.pdf`,
          content: Buffer.from(pdfBuffer).toString("base64"),
        },
      ],
    });

    if (error) return { ok: false, error: error.message };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: new Date() },
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
