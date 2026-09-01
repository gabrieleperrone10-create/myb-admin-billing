export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import ContractForm from "./ContractForm";

export default async function NewContractPage() {
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, company: true } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, basePrice: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Contratto</h1>
        <p className="text-gray-500 mt-1">Associa un cliente a un prodotto o servizio</p>
      </div>
      <ContractForm clients={clients} products={products} />
    </div>
  );
}
