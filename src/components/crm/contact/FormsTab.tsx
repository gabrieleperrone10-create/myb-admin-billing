import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente B — form compilati (FormSubmission)
export default async function FormsTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
