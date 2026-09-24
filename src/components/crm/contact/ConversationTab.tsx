import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente C — thread email + WhatsApp e composer
export default async function ConversationTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
