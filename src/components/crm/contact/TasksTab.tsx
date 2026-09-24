import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente Task.
export default async function TasksTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
