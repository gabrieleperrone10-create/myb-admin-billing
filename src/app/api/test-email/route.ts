import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import { Resend } from "resend";
import React from "react";

// Endpoint temporaneo per test — rimuovere dopo verifica
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = req.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json({ error: "Missing ?to=email" }, { status: 400 });

  const [invoice, company] = await Promise.all([
    prisma.invoice.findFirst({
      where:   { status: { not: "CANCELLED" } },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!invoice) return NextResponse.json({ error: "Nessuna fattura trovata" }, { status: 404 });

  const rawItems = (invoice.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? li.qty ?? 1),
    unitPrice:   Number(li.unitPrice ?? li.price ?? 0),
    total:       Number(li.total ?? li.price ?? 0),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDF as any, {
    invoice: {
      number: invoice.number, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
      paidAt: invoice.paidAt, status: invoice.status, notes: invoice.notes,
      amount: invoice.amount, lineItems,
      client: {
        name: invoice.client.name, company: invoice.client.company,
        email: invoice.client.email, vatNumber: invoice.client.vatNumber,
        fiscalCode: invoice.client.fiscalCode, address: invoice.client.address,
        city: invoice.client.city, zip: invoice.client.zip,
        province: invoice.client.province, country: invoice.client.country,
      },
    },
    company: {
      name: company.name, email: company.email, phone: company.phone,
      website: company.website, vatNumber: company.vatNumber, fiscalCode: company.fiscalCode,
      address: company.address, city: company.city, zip: company.zip,
      province: company.province, country: company.country,
      bankName: company.bankName, iban: company.iban, bic: company.bic,
      invoiceFooter: company.invoiceFooter,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const pdfBuffer = await renderToBuffer(element);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromName  = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const amount    = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(invoice.amount);

  const { error } = await resend.emails.send({
    from:    `${fromName} <${fromEmail}>`,
    to:      [to],
    subject: `[TEST] Fattura ${invoice.number} — ${amount}`,
    html: `
      <p>Questa è una <strong>email di test</strong> per verificare il flusso di invio fatture.</p>
      <p>Fattura: <strong>${invoice.number}</strong> — ${amount}</p>
      <p>Cliente originale: ${invoice.client.name}</p>
      <p>Il PDF della fattura è allegato.</p>
    `,
    attachments: [{
      filename: `${invoice.number}.pdf`,
      content:  Buffer.from(pdfBuffer).toString("base64"),
    }],
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:      true,
    invoice: invoice.number,
    sentTo:  to,
  });
}
