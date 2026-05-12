import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automation = await prisma.automation.findUnique({ where: { type: "OVERDUE_REMINDER" } });
  if (!automation?.active) {
    return NextResponse.json({ skipped: true, reason: "automation disabled" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Porta a OVERDUE le fatture SENT scadute
  await prisma.invoice.updateMany({
    where: { status: "SENT", dueDate: { lt: today } },
    data:  { status: "OVERDUE" },
  });

  // Trova tutte le fatture OVERDUE con cliente
  const invoices = await prisma.invoice.findMany({
    where:   { status: "OVERDUE" },
    include: { client: true },
  });

  const company = await prisma.companySettings.upsert({
    where: { id: "singleton" }, update: {}, create: { id: "singleton" },
  });

  const fromName  = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo   = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";

  const reminded: string[] = [];
  const skipped:  string[] = [];

  for (const invoice of invoices) {
    if (!invoice.client.email) { skipped.push(invoice.number); continue; }

    // Invia solo se non già sollecitato nelle ultime 48h (sentAt = ultimo invio)
    if (invoice.sentAt) {
      const hoursSince = (Date.now() - new Date(invoice.sentAt).getTime()) / 36e5;
      if (hoursSince < 48) { skipped.push(invoice.number); continue; }
    }

    try {
      const rawItems  = (invoice.lineItems ?? []) as Record<string, unknown>[];
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

      const dueDate  = new Intl.DateTimeFormat("it-IT").format(new Date(invoice.dueDate));
      const amount   = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(invoice.amount);
      const daysLate = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 864e5);

      const html = `
        <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
          <div style="border-bottom:3px solid #dc2626;padding-bottom:16px;margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#dc2626;">${fromName}</span>
          </div>
          <div style="background:#fef2f2;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:inline-block;">
            <span style="font-size:13px;font-weight:600;color:#dc2626;">⚠️ SOLLECITO — ${invoice.number}</span>
          </div>
          <p style="font-size:16px;margin-bottom:8px;">Gentile ${invoice.client.name},</p>
          <p style="color:#4b5563;line-height:1.6;">
            ti ricordiamo che la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong>
            risulta <strong>scaduta il ${dueDate}</strong> (${daysLate} ${daysLate === 1 ? "giorno" : "giorni"} fa)
            e non è ancora stata saldata. Ti chiediamo di provvedere al pagamento il prima possibile.
          </p>
          ${company.iban ? `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Coordinate bancarie</p>
            ${company.bankName ? `<p style="margin:4px 0;font-size:14px;">Banca: <strong>${company.bankName}</strong></p>` : ""}
            <p style="margin:4px 0;font-size:14px;">IBAN: <strong>${company.iban}</strong></p>
            ${company.bic ? `<p style="margin:4px 0;font-size:14px;">BIC/SWIFT: <strong>${company.bic}</strong></p>` : ""}
            <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Causale: ${invoice.number}</p>
          </div>` : ""}
          <p style="color:#4b5563;line-height:1.6;margin-top:20px;">
            Per chiarimenti scrivici a <a href="mailto:${replyTo}" style="color:#dc2626;">${replyTo}</a>.
          </p>
          <p style="color:#4b5563;margin-top:20px;">Grazie,<br><strong>${fromName}</strong></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:11px;color:#9ca3af;">${company.email}${company.phone ? ` · ${company.phone}` : ""}</p>
        </body></html>
      `;

      await resend.emails.send({
        from:        `${fromName} <${fromEmail}>`,
        replyTo,
        to:          [invoice.client.email],
        subject:     `⚠️ Sollecito pagamento ${invoice.number} — ${amount}`,
        html,
        attachments: [{ filename: `${invoice.number}.pdf`, content: Buffer.from(pdfBuffer).toString("base64") }],
      });

      await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } });
      reminded.push(invoice.number);
    } catch {
      skipped.push(invoice.number);
    }
  }

  await prisma.automation.update({ where: { type: "OVERDUE_REMINDER" }, data: { lastRunAt: new Date() } });

  return NextResponse.json({ ok: true, reminded, skipped });
}
