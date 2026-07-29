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
        where:   { OR: [{ notes: null }, { notes: { not: "Acconto / deposito" } }], status: { not: "CANCELLED" } },
        orderBy: { issueDate: "asc" },
      },
    },
  });

  const today   = new Date();
  const created: string[] = [];

  for (const contract of contracts) {
    // Non iniziare le rate se il deposito non è stato pagato
    if (contract.deposit && contract.deposit.status !== "PAID") continue;

    const months = PERIOD_MONTHS[contract.billingPeriod] ?? 1;
    const day    = contract.billingDay ?? 1;
    const start  = new Date(contract.startDate);

    // Genera TUTTE le fatture arretrate in un'unica passata
    let invoiceCount = contract.invoices.length;

    while (true) {
      // ONE_SHOT: max 1 fattura
      if (contract.type === "ONE_SHOT" && invoiceCount >= 1) break;

      // INSTALLMENT: max N rate
      if (contract.type === "INSTALLMENT") {
        const n = contract.installments ?? 1;
        if (invoiceCount >= n) break;
      }

      const nextDate = new Date(start.getFullYear(), start.getMonth() + invoiceCount * months, day);

      // Non ancora in scadenza
      if (nextDate > today) break;

      // Data fine contratto superata (solo RECURRING)
      if (contract.type === "RECURRING" && contract.endDate && nextDate > new Date(contract.endDate)) break;

      const installmentAmount =
        contract.type === "INSTALLMENT"
          ? contract.amount / (contract.installments ?? 1)
          : contract.amount;

      const dueDate = new Date(nextDate);
      dueDate.setDate(dueDate.getDate() + 15);

      const number = await nextInvoiceNumber();
      await prisma.invoice.create({
        data: {
          number,
          clientId:   contract.clientId,
          contractId: contract.id,
          amount:     installmentAmount,
          status:     "DRAFT",
          issueDate:  nextDate,
          dueDate,
          lineItems: [
            {
              description: `${contract.product.name} — rata ${invoiceCount + 1}${contract.installments ? `/${contract.installments}` : ""}`,
              quantity:    1,
              unitPrice:   installmentAmount,
              total:       installmentAmount,
            },
          ],
        },
      });

      created.push(`${contract.id} → ${number} (rata ${invoiceCount + 1})`);
      invoiceCount++;
    }
  }

  await prisma.automation.update({
    where: { type: "RECURRING_INVOICES" },
    data:  { lastRunAt: new Date() },
  });

  return NextResponse.json({ ok: true, created });
}
