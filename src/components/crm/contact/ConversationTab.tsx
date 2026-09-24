import type { ContactTabProps } from "./types";
import ConversationView from "@/components/crm/conversations/ConversationView";

/** Tab "Conversazione": thread unico email + WhatsApp con composer. */
export default async function ConversationTab({ slug, contactId }: ContactTabProps) {
  return <ConversationView slug={slug} contactId={contactId} variant="tab" />;
}
