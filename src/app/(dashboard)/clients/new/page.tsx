export const dynamic = "force-dynamic";
import ClientForm from "../ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo Cliente</h1>
        <p className="text-gray-500 mt-1">Inserisci i dati anagrafici del cliente</p>
      </div>
      <ClientForm />
    </div>
  );
}
