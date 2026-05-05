import ProductForm from "../ProductForm";

export default function NewProductPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Prodotto / Servizio</h1>
        <p className="text-gray-500 mt-1">Aggiungi un prodotto o servizio al catalogo</p>
      </div>
      <ProductForm />
    </div>
  );
}
