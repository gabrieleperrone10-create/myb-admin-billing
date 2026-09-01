export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import InvoiceForm from "./InvoiceForm";

export default async function NewInvoicePage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db } = await requireCompany(slug);
  const [clients, contracts] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    db.contract.findMany({
      where: { active: true },
      include: { client: true, product: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuova Fattura</h1>
        <p className="text-gray-500 mt-1">Crea una nuova fattura manuale</p>
      </div>
      <InvoiceForm clients={clients} contracts={contracts} />
    </div>
  );
}
