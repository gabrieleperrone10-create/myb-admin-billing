export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle, Clock, FileText, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { updateContractStatus } from "@/app/actions/contracts";
import MarkDepositPaidModal from "./MarkDepositPaidModal";

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Mensile", QUARTERLY: "Trimestrale", ANNUALLY: "Annuale",
};
const PERIOD_MONTHS: Record<string, number> = {
  MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12,
};

function nextInstallmentDate(contract: {
  startDate: Date; billingDay: number | null; billingPeriod: string; installments: number | null;
}, invoiceCount: number): Date | null {
  const months   = PERIOD_MONTHS[contract.billingPeriod] ?? 1;
  const day      = contract.billingDay ?? 1;
  const start    = new Date(contract.startDate);
  const nextNum  = invoiceCount; // 0-based: 0 = first installment
  const d        = new Date(start.getFullYear(), start.getMonth() + nextNum * months, day);
  return d;
}

const STATUS_INVOICE: Record<string, { label: string; cls: string }> = {
  PAID:      { label: "Pagata",    cls: "bg-green-100 text-green-700" },
  SENT:      { label: "Inviata",   cls: "bg-blue-100 text-blue-700" },
  OVERDUE:   { label: "Scaduta",   cls: "bg-red-100 text-red-700" },
  DRAFT:     { label: "Bozza",     cls: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Annullata", cls: "bg-gray-100 text-gray-400" },
};

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      client:  true,
      product: true,
      deposit: { include: { payment: true } },
      invoices: {
        where:   { notes: { not: "Acconto / deposito" } },
        orderBy: { issueDate: "asc" },
      },
    },
  });

  if (!contract) notFound();

  // Fattura acconto separata
  const depositInvoice = await prisma.invoice.findFirst({
    where: { contractId: id, notes: "Acconto / deposito" },
  });

  const toggleActive = updateContractStatus.bind(null, id, !contract.active);

  const installmentAmount = contract.type === "ONE_SHOT" && contract.installments
    ? contract.amount / contract.installments
    : contract.amount;

  const validInvoices = contract.invoices.filter(inv => inv.status !== "CANCELLED");
  const invoiceCount  = validInvoices.length;
  const totalInstallments = contract.installments ?? null;
  const depositReady  = !contract.deposit || contract.deposit.status === "PAID";

  const nextDate = depositReady
    ? nextInstallmentDate(
        { ...contract, billingPeriod: contract.billingPeriod as string },
        invoiceCount,
      )
    : null;

  const canGenerateNext =
    depositReady &&
    (totalInstallments === null || invoiceCount < totalInstallments) &&
    nextDate !== null &&
    nextDate <= new Date();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/contracts" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{contract.product.name}</h1>
            <Badge variant={contract.active ? "ok" : "neutral"}>{contract.active ? "Attivo" : "Inattivo"}</Badge>
          </div>
          <p className="text-gray-500 mt-1">{contract.client.name}{contract.client.company ? ` — ${contract.client.company}` : ""}</p>
        </div>
        <form action={toggleActive}>
          <button type="submit" className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            {contract.active ? <><XCircle className="w-3.5 h-3.5 inline mr-1" />Disattiva</> : "Riattiva"}
          </button>
        </form>
      </div>

      {/* Riepilogo contratto */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Tipo</p>
          <p className="font-semibold text-gray-900">{contract.type === "RECURRING" ? "Ricorrente" : "Una tantum"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Periodo</p>
          <p className="font-semibold text-gray-900">{PERIOD_LABEL[contract.billingPeriod as string] ?? contract.billingPeriod}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">
            {contract.type === "RECURRING" ? "Importo / periodo" : "Totale contratto"}
          </p>
          <p className="font-semibold text-gray-900">{formatCurrency(contract.amount)}</p>
          {contract.installments && (
            <p className="text-xs text-gray-500">{contract.installments} rate × {formatCurrency(installmentAmount)}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-medium mb-1">Inizio</p>
          <p className="font-semibold text-gray-900">{formatDate(contract.startDate)}</p>
          {contract.endDate && <p className="text-xs text-gray-500">Fine: {formatDate(contract.endDate)}</p>}
        </div>
      </div>

      {/* Deposito */}
      {contract.deposit && (
        <div className={`rounded-xl border p-5 ${
          contract.deposit.status === "PAID"
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {contract.deposit.status === "PAID"
                ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                : <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              }
              <div>
                <p className={`text-sm font-semibold ${contract.deposit.status === "PAID" ? "text-green-800" : "text-amber-800"}`}>
                  Deposito {contract.deposit.status === "PAID" ? "pagato" : "in attesa"}
                </p>
                <p className={`text-xs mt-0.5 ${contract.deposit.status === "PAID" ? "text-green-600" : "text-amber-600"}`}>
                  {formatCurrency(contract.deposit.amount)}
                  {contract.deposit.paidAt ? ` — pagato il ${formatDate(contract.deposit.paidAt)}` : " — le rate iniziano dopo il pagamento"}
                </p>
                {depositInvoice && (
                  <a href={`/api/invoices/${depositInvoice.id}/pdf`} target="_blank"
                    className="text-xs text-green-700 underline mt-1 inline-block">
                    Fattura acconto {depositInvoice.number}
                  </a>
                )}
              </div>
            </div>
            {contract.deposit.status === "PENDING" && (
              <MarkDepositPaidModal
                depositId={contract.deposit.id}
                contractId={contract.id}
                amount={contract.deposit.amount}
              />
            )}
          </div>
        </div>
      )}

      {/* Piano rate / fatture */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Piano fatturazione</h2>
            {totalInstallments
              ? <p className="text-xs text-gray-500 mt-0.5">{invoiceCount} / {totalInstallments} rate generate</p>
              : <p className="text-xs text-gray-500 mt-0.5">{invoiceCount} fatture generate</p>
            }
          </div>
          {totalInstallments && (
            <div className="w-32 bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (invoiceCount / totalInstallments) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {validInvoices.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            {depositReady
              ? "Nessuna fattura generata ancora. Il cron le creerà automaticamente."
              : "Le fatture verranno generate dopo il pagamento del deposito."}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500">#</th>
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500">Numero</th>
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500">Scadenza</th>
                <th className="text-right px-6 py-2 text-xs font-medium text-gray-500">Importo</th>
                <th className="text-left px-6 py-2 text-xs font-medium text-gray-500">Stato</th>
                <th className="px-6 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {validInvoices.map((inv, i) => {
                const s = STATUS_INVOICE[inv.status] ?? { label: inv.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-400">{i + 1}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{inv.number}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(inv.dueDate)}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/invoices/${inv.id}`} className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 justify-end">
                        <FileText className="w-3 h-3" /> Apri
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Prossima rata */}
        {nextDate && (totalInstallments === null || invoiceCount < totalInstallments) && depositReady && (
          <div className="px-6 py-3 border-t border-dashed border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              Prossima rata:
              <span className="font-medium text-gray-700">
                {formatDate(nextDate)} — {formatCurrency(installmentAmount)}
              </span>
              {canGenerateNext && <span className="text-xs text-amber-600 font-medium">(scaduta)</span>}
            </div>
            {totalInstallments && invoiceCount >= totalInstallments && (
              <span className="text-xs text-green-600 font-medium">Piano completato ✓</span>
            )}
          </div>
        )}

        {totalInstallments && invoiceCount >= totalInstallments && (
          <div className="px-6 py-3 border-t border-gray-100 text-center text-sm text-green-600 font-medium">
            Piano completato — tutte le {totalInstallments} rate generate ✓
          </div>
        )}
      </div>

      {contract.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 mb-1 uppercase font-medium">Note</p>
          <p className="text-sm text-gray-600">{contract.notes}</p>
        </div>
      )}
    </div>
  );
}
