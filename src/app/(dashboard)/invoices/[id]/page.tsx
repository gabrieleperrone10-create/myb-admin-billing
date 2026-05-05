export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle, Send, XCircle, Download } from "lucide-react";
import Link from "next/link";
import MarkPaidModal from "./MarkPaidModal";
import SendEmailButton from "./SendEmailButton";
import WhatsAppButton from "./WhatsAppButton";
import { updateInvoiceStatus } from "@/app/actions/invoices";

const STATUS_CLASS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  SENT: "bg-blue-100 text-blue-700",
  OVERDUE: "bg-red-100 text-red-700",
  DRAFT: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  PAID: "Pagata", SENT: "Inviata", OVERDUE: "Scaduta", DRAFT: "Bozza", CANCELLED: "Annullata",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { client: true, contract: { include: { product: true } }, payment: true },
    }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!invoice) notFound();

  const rawItems = (invoice.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? li.qty ?? 1),
    unitPrice:   Number(li.unitPrice ?? li.price ?? 0),
    total:       Number(li.total ?? li.price ?? 0),
  }));

  const markSent = updateInvoiceStatus.bind(null, id, "SENT");
  const markCancelled = updateInvoiceStatus.bind(null, id, "CANCELLED");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/invoices" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>
          <p className="text-gray-500 mt-1">{invoice.client.name}</p>
        </div>

        {/* Azioni */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/invoices/${id}/pdf`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </a>

          <SendEmailButton invoiceId={id} clientEmail={invoice.client.email} />

          <WhatsAppButton
            whatsapp={invoice.client.whatsapp}
            clientName={invoice.client.name}
            invoiceNumber={invoice.number}
            amount={invoice.amount}
            dueDate={invoice.dueDate}
            iban={company.iban}
            companyName={company.name || "Market Your Business"}
            replyEmail={process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it"}
          />

          {invoice.status === "DRAFT" && (
            <form action={markSent}>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <Send className="w-3.5 h-3.5" /> Segna inviata
              </button>
            </form>
          )}
          {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
            <MarkPaidModal invoiceId={id} amount={invoice.amount} />
          )}
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <form action={markCancelled}>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                <XCircle className="w-3.5 h-3.5" /> Annulla
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Info fattura */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Emessa a</p>
            <p className="font-semibold text-gray-900">{invoice.client.name}</p>
            {invoice.client.company && <p className="text-sm text-gray-600">{invoice.client.company}</p>}
            {invoice.client.vatNumber && <p className="text-sm text-gray-500">P.IVA: {invoice.client.vatNumber}</p>}
            {invoice.client.email && <p className="text-sm text-gray-500">{invoice.client.email}</p>}
            {invoice.client.whatsapp && (
              <p className="text-sm text-emerald-600">WhatsApp: {invoice.client.whatsapp}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Fattura</p>
            <p className="font-semibold text-gray-900">{invoice.number}</p>
            <p className="text-sm text-gray-500">Emessa: {formatDate(invoice.issueDate)}</p>
            <p className="text-sm text-gray-500">Scadenza: {formatDate(invoice.dueDate)}</p>
            {invoice.paidAt && <p className="text-sm text-green-600">Pagata: {formatDate(invoice.paidAt)}</p>}
          </div>
        </div>

        {/* Voci */}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-xs font-medium text-gray-500">Descrizione</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Qtà</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Prezzo</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Totale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((li, i) => (
              <tr key={i}>
                <td className="py-3 text-sm text-gray-900">{li.description}</td>
                <td className="py-3 text-sm text-gray-600 text-right">{li.quantity}</td>
                <td className="py-3 text-sm text-gray-600 text-right">{formatCurrency(li.unitPrice)}</td>
                <td className="py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(li.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td colSpan={3} className="py-3 text-sm font-semibold text-gray-900 text-right">Totale</td>
              <td className="py-3 text-lg font-bold text-gray-900 text-right">{formatCurrency(invoice.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {invoice.notes && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-1">Note</p>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Pagamento registrato */}
      {invoice.payment && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Pagamento ricevuto</p>
            <p className="text-xs text-green-600 mt-0.5">
              {formatCurrency(invoice.payment.amount)} via{" "}
              {invoice.payment.method.replace("_", " ")} — {formatDate(invoice.payment.paidAt)}
              {invoice.payment.reference && ` · Rif: ${invoice.payment.reference}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
