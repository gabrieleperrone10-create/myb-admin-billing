import type { ContactTabProps } from "./types";

// Segnaposto. Proprietario: agente B — cronologia (Activity) con filtri per tipo e note
export default async function ActivityTab({ contactId }: ContactTabProps) {
  void contactId;
  return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>In costruzione</p>;
}
