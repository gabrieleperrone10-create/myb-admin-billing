import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MessageCircle } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { contactDisplayName } from "@/lib/crm/contacts";
import OverviewTab from "@/components/crm/contact/OverviewTab";
import ActivityTab from "@/components/crm/contact/ActivityTab";
import ConversationTab from "@/components/crm/contact/ConversationTab";
import OpportunitiesTab from "@/components/crm/contact/OpportunitiesTab";
import AppointmentsTab from "@/components/crm/contact/AppointmentsTab";
import FormsTab from "@/components/crm/contact/FormsTab";

/**
 * Scheda contatto: header + tab. La tab attiva e' in ?tab= (link condivisibili,
 * nessuno stato client) e viene renderizzata solo lei: ogni tab carica i propri
 * dati, quindi le altre non costano nulla.
 */
const TABS = [
  { key: "overview", label: "Dettagli", Component: OverviewTab },
  { key: "activity", label: "Attività", Component: ActivityTab },
  { key: "conversation", label: "Conversazione", Component: ConversationTab },
  { key: "opportunities", label: "Opportunità", Component: OpportunitiesTab },
  { key: "appointments", label: "Appuntamenti", Component: AppointmentsTab },
  { key: "forms", label: "Form", Component: FormsTab },
] as const;

const LIFECYCLE: Record<string, { label: string; color: string }> = {
  LEAD: { label: "Lead", color: "#f97316" },
  CUSTOMER: { label: "Cliente", color: "#10b981" },
  ARCHIVED: { label: "Archiviato", color: "#94a3b8" },
};

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ company: slug, id }, { tab }] = await Promise.all([params, searchParams]);
  const { db } = await requireCompany(slug);
  const contact = await db.contact.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!contact) notFound();

  const active = TABS.find(t => t.key === tab) ?? TABS[0];
  const lc = LIFECYCLE[contact.lifecycle];
  const name = contactDisplayName(contact);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start gap-4">
        <Link href={companyPath(slug, "/contacts")} className="mt-1" style={{ color: "var(--fg-3)" }} aria-label="Torna ai contatti">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] font-semibold truncate" style={{ color: "var(--fg)" }}>{name}</h1>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${lc.color}1a`, color: lc.color }}
            >
              {lc.label}
            </span>
            {contact.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${tag.color}1a`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-[13px] flex-wrap" style={{ color: "var(--fg-2)" }}>
            {contact.companyName && <span>{contact.companyName}</span>}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:underline">
                <Mail className="w-3.5 h-3.5" /> {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                <Phone className="w-3.5 h-3.5" /> {contact.phone}
              </a>
            )}
            {(contact.whatsapp ?? contact.phone) && (
              <Link
                href={companyPath(slug, `/contacts/${contact.id}?tab=conversation`)}
                className="flex items-center gap-1 hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => {
          const on = t.key === active.key;
          return (
            <Link
              key={t.key}
              href={companyPath(slug, `/contacts/${contact.id}?tab=${t.key}`)}
              className="px-3 py-2 text-[13px] whitespace-nowrap -mb-px"
              style={{
                color: on ? "var(--fg)" : "var(--fg-3)",
                borderBottom: on ? "2px solid var(--fg)" : "2px solid transparent",
                fontWeight: on ? 600 : 400,
              }}
            >
              {t.label}
              {t.key === "conversation" && contact.unreadCount > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#f97316" }}>
                  {contact.unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <active.Component slug={slug} contactId={contact.id} />
    </div>
  );
}
