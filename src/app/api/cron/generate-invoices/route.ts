import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PERIOD_MONTHS: Record<string, number> = {
  MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12,
};

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const all  = await prisma.invoice.findMany({ select: { number: true } });
  let max = 0;
  for (const inv of all) {
    const match = inv.number.match(/^MYB-\d{4}-(\d+)$/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > max) max = n;
    }
  }
  return `MYB-${year}-${String(max + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automation = await prisma.automation.findUnique({
    where: { type: "RECURRING_INVOICES" },
  });
  if (!automation?.active) {
    return NextResponse.json({ skipped: true, reason: "automation disabled" });
  }

  const contracts = await prisma.contract.findMany({
    where: { active: true },
    include: {
      product: true,
      deposit:  true,
      invoices: {
        where:   { notes: { not: "Acconto / deposito" }, status: { not: "CANCELLED" } },
        orderBy: { issueDate: "asc" },
      },
    },
  });

  const today    = new Date();
  const created: string[] = [];

  for (const contract of contracts) {
    // Non iniziare le rate se il deposito non è stato pagato
    if (contract.deposit && contract.deposit.status !== "PAID") continue;

    const months           = PERIOD_MONTHS[contract.billingPeriod] ?? 1;
    const day              = contract.billingDay ?? 1;
    const invoiceCount     = contract.invoices.length;
    const totalInstallments = contract.installments;

    // Contratto ONE_SHOT completato
    if (totalInstallments !== null && invoiceCount >= totalInstallments) continue;

    // Calcola data prossima rata
    const start    = new Date(contract.startDate);
    const nextDate = new Date(start.getFullYear(), start.getMonth() + invoiceCount * months, day);

    // Non ancora in scadenza
    if (nextDate > today) continue;

    // Data fine contratto superata
    if (contract.endDate && nextDate > new Date(contract.endDate)) continue;

    const installmentAmount = totalInstallments
      ? contract.amount / totalInstallments
      : contract.amount;

    const number = await nextInvoiceNumber();
    const dueDate = new Date(nextDate);
    dueDate.setDate(dueDate.getDate() + 15); // 15 giorni per pagare

    await prisma.invoice.create({
      data: {
        number,
        clientId:   contract.clientId,
        contractId: contract.id,
        amount:     installmentAmount,
        status:     "DRAFT",
        issueDate:  nextDate,
        dueDate,
        lineItems:  [
          {
            description: `${contract.product.name} — rata ${invoiceCount + 1}${totalInstallments ? `/${totalInstallments}` : ""}`,
            quantity:    1,
            unitPrice:   installmentAmount,
            total:       installmentAmount,
          },
        ],
      },
    });

    created.push(`${contract.id} → ${number}`);
  }

  await prisma.automation.update({
    where: { type: "RECURRING_INVOICES" },
    data:  { lastRunAt: new Date() },
  });

  return NextResponse.json({ ok: true, created });
}
