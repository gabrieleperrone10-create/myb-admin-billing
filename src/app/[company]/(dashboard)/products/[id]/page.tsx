import { requireCompany } from "@/lib/company";
import { notFound } from "next/navigation";
import ProductForm from "../ProductForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProductDetailPage({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;
  const { db } = await requireCompany(slug);
  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/${slug}/products`} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-gray-500 mt-1">Modifica prodotto</p>
        </div>
      </div>
      <ProductForm product={product} />
    </div>
  );
}
