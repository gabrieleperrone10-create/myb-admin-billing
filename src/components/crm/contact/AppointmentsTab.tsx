import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente F — appuntamenti del contatto e prenotazione
export default async function AppointmentsTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
