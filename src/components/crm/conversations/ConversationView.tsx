import { requireCompany } from "@/lib/company";
import ConversationPanel from "./ConversationPanel";
import { loadConversation } from "./data";

/** Server Component: carica la conversazione del contatto e la passa al pannello client. */
export default async function ConversationView({
  slug,
  contactId,
  variant = "tab",
}: {
  slug: string;
  contactId: string;
  variant?: "tab" | "inbox";
}) {
  const ctx = await requireCompany(slug);
  const data = await loadConversation(ctx, contactId);
  if (!data) {
    return (
      <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>
        Contatto non trovato.
      </p>
    );
  }
  return <ConversationPanel slug={slug} data={data} variant={variant} />;
}
