import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import React from "react";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { client: true } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
    },
  });
}
