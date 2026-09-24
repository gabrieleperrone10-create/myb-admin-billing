export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import ContractForm from "./ContractForm";

export default async function NewContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  // Precompilazione da "Opportunità vinta" (CRM)
  searchParams: Promise<{ clientId?: string; productId?: string; amount?: string; opportunityId?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const { db } = await requireCompany(slug);
  const [clients, products] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, basePrice: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Contratto</h1>
        <p className="text-gray-500 mt-1">Associa un cliente a un prodotto o servizio</p>
      </div>
      <ContractForm
        clients={clients}
        products={products}
        defaults={{
          clientId: clients.some(c => c.id === sp.clientId) ? sp.clientId : undefined,
          productId: products.some(p => p.id === sp.productId) ? sp.productId : undefined,
          amount: sp.amount && Number.isFinite(Number(sp.amount)) ? sp.amount : undefined,
          opportunityId: sp.opportunityId,
        }}
      />
    </div>
  );
}
