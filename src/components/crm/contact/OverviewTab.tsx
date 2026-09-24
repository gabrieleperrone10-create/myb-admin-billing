import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente B — campi standard + custom con modifica diretta, etichette, cliente collegato
export default async function OverviewTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
