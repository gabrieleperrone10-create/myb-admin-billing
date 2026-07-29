import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import CreditNotePDF from "@/lib/pdf/CreditNotePDF";
import React from "react";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [creditNote, company] = await Promise.all([
    prisma.creditNote.findUnique({ where: { id } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!creditNote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawItems = (creditNote.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? 1),
    unitPrice:   Number(li.unitPrice ?? 0),
    total:       Number(li.total ?? 0),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CreditNotePDF as any, {
    creditNote: {
      number: creditNote.number,
      issueDate: creditNote.issueDate,
      reason: creditNote.reason,
      notes: creditNote.notes,
      amount: creditNote.amount,
      currency: creditNote.currency,
      lineItems,
      originalInvoiceNumber: creditNote.originalInvoiceNumber,
      originalInvoiceDate: creditNote.originalInvoiceDate,
      client: {
        name: creditNote.clientName,
        company: creditNote.clientCompany,
        email: creditNote.clientEmail,
        vatNumber: creditNote.clientVatNumber,
        fiscalCode: creditNote.clientFiscalCode,
        address: creditNote.clientAddress,
        city: creditNote.clientCity,
        zip: creditNote.clientZip,
        province: creditNote.clientProvince,
        country: creditNote.clientCountry,
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
      invoiceFooter: company.invoiceFooter,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${creditNote.number}.pdf"`,
    },
  });
}
