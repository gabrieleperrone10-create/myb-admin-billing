import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import ClientForm from "../ClientForm";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MessageCircle } from "lucide-react";

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

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contracts: { include: { product: true, deposit: true } },
      invoices: { orderBy: { issueDate: "desc" }, take: 10 },
    },
  });
  if (!client) notFound();

  const totalPaid = client.invoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/clients" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          {client.company && <p className="text-gray-500">{client.company}</p>}
        </div>
      </div>

      {/* Contatti rapidi */}
      <div className="flex flex-wrap gap-3">
        {client.email && (
          <a href={`mailto:${client.email}`} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Mail className="w-4 h-4 text-blue-500" /> {client.email}
          </a>
        )}
        {client.phone && (
          <a href={`tel:${client.phone}`} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <Phone className="w-4 h-4 text-green-500" /> {client.phone}
          </a>
        )}
        {client.whatsapp && (
          <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            <MessageCircle className="w-4 h-4 text-emerald-500" /> WhatsApp
          </a>
        )}
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
          <p className="text-xs text-gray-500 mt-1">Totale incassato</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{client.contracts.length}</p>
          <p className="text-xs text-gray-500 mt-1">Contratti</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{client.invoices.length}</p>
          <p className="text-xs text-gray-500 mt-1">Fatture</p>
        </div>
      </div>

      {/* Ultime fatture */}
      {client.invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Fatture recenti</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {client.invoices.map((inv) => (
              <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[inv.status]}`}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                  <span className="text-sm font-mono text-gray-500">{inv.number}</span>
                  <span className="text-sm text-gray-500">{formatDate(inv.issueDate)}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form modifica */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Modifica dati</h2>
        <ClientForm client={client} />
      </div>
    </div>
  );
}
