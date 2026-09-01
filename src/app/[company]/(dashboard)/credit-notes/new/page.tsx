export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import CreditNoteForm from "./CreditNoteForm";

export default async function NewCreditNotePage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db } = await requireCompany(slug);
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, company: true, email: true,
      vatNumber: true, fiscalCode: true, address: true,
      city: true, zip: true, province: true, country: true,
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuova nota di credito</h1>
        <p className="text-gray-500 mt-1">
          Per fatture vecchie non presenti nel gestionale — inserisci manualmente cliente e riferimenti.
        </p>
      </div>
      <CreditNoteForm clients={clients} />
    </div>
  );
}
