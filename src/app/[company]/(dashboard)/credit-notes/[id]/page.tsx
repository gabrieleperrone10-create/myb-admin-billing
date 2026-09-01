export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, XCircle, Download, FileText } from "lucide-react";
import Link from "next/link";
import SendCreditNoteEmailButton from "./SendCreditNoteEmailButton";
import { updateCreditNoteStatus, deleteCreditNote } from "@/app/actions/creditNotes";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";

const STATUS_CLASS: Record<string, string> = {
  ISSUED:    "bg-blue-100 text-blue-700",
  SENT:      "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<string, string> = {
  ISSUED: "Emessa", SENT: "Inviata", CANCELLED: "Annullata",
};

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;
  const { db } = await requireCompany(slug);

  const creditNote = await db.creditNote.findUnique({ where: { id } });
  if (!creditNote) notFound();

  const rawItems = (creditNote.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? 1),
    unitPrice:   Number(li.unitPrice ?? 0),
    total:       Number(li.total ?? 0),
  }));

  const markCancelled = updateCreditNoteStatus.bind(null, slug, id, "CANCELLED");
  const deleteAction = deleteCreditNote.bind(null, slug, id);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/${slug}/credit-notes`} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{creditNote.number}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[creditNote.status]}`}>
              {STATUS_LABEL[creditNote.status]}
            </span>
          </div>
          <p className="text-gray-500 mt-1">{creditNote.clientName}</p>
        </div>

        {/* Azioni */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/credit-notes/${id}/pdf?company=${slug}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </a>

          <SendCreditNoteEmailButton creditNoteId={id} clientEmail={creditNote.clientEmail} />

          {creditNote.status !== "CANCELLED" && (
            <form action={markCancelled}>
              <button type="submit" className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                <XCircle className="w-3.5 h-3.5" /> Annulla
              </button>
            </form>
          )}
          {creditNote.status !== "SENT" && (
            <DeleteConfirmButton
              action={deleteAction}
              message="Eliminare definitivamente questa nota di credito?"
            />
          )}
        </div>
      </div>

      {/* Riferimento fattura originale */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-3">
        <FileText className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800">
            Riferita alla fattura {creditNote.originalInvoiceNumber}
            {creditNote.originalInvoiceDate && ` del ${formatDate(creditNote.originalInvoiceDate)}`}
          </p>
          {creditNote.invoiceId ? (
            <Link href={`/${slug}/invoices/${creditNote.invoiceId}`} className="text-xs text-blue-600 hover:underline mt-0.5 inline-block">
              Vai alla fattura nel gestionale
            </Link>
          ) : (
            <p className="text-xs text-blue-600 mt-0.5">Fattura non presente nel gestionale (nota di credito manuale)</p>
          )}
        </div>
      </div>

      {/* Info nota di credito */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8">
        <div className="flex justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Emessa a</p>
            <p className="font-semibold text-gray-900">{creditNote.clientName}</p>
            {creditNote.clientCompany && <p className="text-sm text-gray-600">{creditNote.clientCompany}</p>}
            {creditNote.clientVatNumber && <p className="text-sm text-gray-500">P.IVA: {creditNote.clientVatNumber}</p>}
            {creditNote.clientEmail && <p className="text-sm text-gray-500">{creditNote.clientEmail}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Nota di credito</p>
            <p className="font-semibold text-gray-900">{creditNote.number}</p>
            <p className="text-sm text-gray-500">Emessa: {formatDate(creditNote.issueDate)}</p>
            {creditNote.sentAt && <p className="text-sm text-green-600">Inviata: {formatDate(creditNote.sentAt)}</p>}
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
              <td colSpan={3} className="py-3 text-sm font-semibold text-gray-900 text-right">Totale a storno</td>
              <td className="py-3 text-lg font-bold text-red-600 text-right">-{formatCurrency(creditNote.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {creditNote.reason && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-1">Motivo</p>
            <p className="text-sm text-gray-600">{creditNote.reason}</p>
          </div>
        )}

        {creditNote.notes && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-1">Note</p>
            <p className="text-sm text-gray-600">{creditNote.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
