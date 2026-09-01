import { NextRequest, NextResponse } from "next/server";
import { forEachCompany, isAuthorizedCron } from "@/lib/cron";
import { nextInvoiceNumber } from "@/lib/numbering";

const PERIOD_MONTHS: Record<string, number> = {
  MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12,
};


export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runs = await forEachCompany("RECURRING_INVOICES", async ({ db, company }) => {

  const contracts = await db.contract.findMany({
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

      // L'anno del numero segue l'anno di emissione della rata, non quello
      // corrente: un contratto con arretrati che attraversano un capodanno deve
      // ricevere numeri nell'anno a cui la rata appartiene, non tutti nell'anno
      // in cui gira il cron.
      const number = await nextInvoiceNumber(
        db, company.id, company.invoicePrefix, company.numberPadding, nextDate.getFullYear(),
      );
      await db.invoice.create({
        data: {
          companyId:  company.id,
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

    return { created };
  });

  return NextResponse.json({ ok: true, runs });
}
