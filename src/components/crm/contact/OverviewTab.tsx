import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { listCompanyMembers } from "@/lib/crm/members";
import type { CustomFieldValues } from "@/lib/crm/customFields";
import type { Attribution } from "@/lib/crm/types";
import { InlineTextField } from "./fields/InlineTextField";
import { CustomFieldEditor } from "./fields/CustomFieldEditor";
import { TagsEditor } from "./fields/TagsEditor";
import { OwnerSelect } from "./fields/OwnerSelect";
import { OptOutToggle } from "./fields/OptOutToggle";
import type { ContactTabProps } from "./types";

const UTM_LABELS: { key: keyof Attribution; label: string }[] = [
  { key: "utm_source", label: "utm_source" },
  { key: "utm_medium", label: "utm_medium" },
  { key: "utm_campaign", label: "utm_campaign" },
  { key: "utm_content", label: "utm_content" },
  { key: "utm_term", label: "utm_term" },
  { key: "fbclid", label: "fbclid" },
  { key: "gclid", label: "gclid" },
  { key: "referrer", label: "Referrer" },
  { key: "landingUrl", label: "Pagina di atterraggio" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-lg)] p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--fg-3)" }}>{title}</h3>
      {children}
    </div>
  );
}

/**
 * Tab Dettagli: campi standard con modifica inline, campi personalizzati,
 * responsabile, etichette, opt-out, origine (attribuzione) e cliente di
 * fatturazione collegato.
 *
 * Proprietario: agente B.
 */
export default async function OverviewTab({ slug, contactId }: ContactTabProps) {
  const { db, companyId } = await requireCompany(slug);

  const [contact, defs, allTags, members] = await Promise.all([
    db.contact.findUnique({
      where: { id: contactId },
      include: { tags: { include: { tag: true } }, client: true },
    }),
    db.customFieldDef.findMany({ where: { entity: "CONTACT" }, orderBy: { order: "asc" } }),
    db.crmTag.findMany({ orderBy: { name: "asc" } }),
    listCompanyMembers(companyId),
  ]);

  if (!contact) return <p className="text-[13px] py-8 text-center" style={{ color: "var(--fg-3)" }}>Contatto non trovato</p>;

  const customValues = (contact.customFields ?? {}) as CustomFieldValues;
  const attribution = (contact.attribution ?? null) as Attribution | null;
  const currentTags = contact.tags.map(t => t.tag);
  const memberOptions = members.map(m => ({ userId: m.userId, name: m.name }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card title="Dati di contatto">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InlineTextField
                label="Nome"
                value={contact.firstName}
                slug={slug} contactId={contactId} field="firstName"
              />
              <InlineTextField
                label="Cognome"
                value={contact.lastName}
                slug={slug} contactId={contactId} field="lastName"
              />
            </div>
            <InlineTextField
              label="Email"
              value={contact.email}
              type="email"
              link="mailto"
              slug={slug} contactId={contactId} field="email"
            />
            <div className="grid grid-cols-2 gap-3">
              <InlineTextField
                label="Telefono"
                value={contact.phone}
                type="tel"
                link="tel"
                slug={slug} contactId={contactId} field="phone"
              />
              <InlineTextField
                label="WhatsApp"
                value={contact.whatsapp}
                type="tel"
                slug={slug} contactId={contactId} field="whatsapp"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InlineTextField
                label="Azienda"
                value={contact.companyName}
                slug={slug} contactId={contactId} field="companyName"
              />
              <InlineTextField
                label="Ruolo"
                value={contact.jobTitle}
                slug={slug} contactId={contactId} field="jobTitle"
              />
            </div>
          </div>
        </Card>

        {defs.length > 0 && (
          <Card title="Campi personalizzati">
            <div className="space-y-3">
              {defs.map(def => (
                <CustomFieldEditor
                  key={def.id}
                  def={{
                    key: def.key,
                    label: def.label,
                    type: def.type,
                    options: Array.isArray(def.options) ? (def.options as unknown[]).map(String) : [],
                    required: def.required,
                  }}
                  value={customValues[def.key] ?? null}
                  slug={slug}
                  contactId={contactId}
                />
              ))}
            </div>
          </Card>
        )}

        <Card title="Comunicazioni">
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            <OptOutToggle slug={slug} contactId={contactId} field="emailOptOut" label="Non inviare email" initial={contact.emailOptOut} />
            <OptOutToggle slug={slug} contactId={contactId} field="whatsappOptOut" label="Non inviare WhatsApp" initial={contact.whatsappOptOut} />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Responsabile">
          <OwnerSelect slug={slug} contactId={contactId} ownerUserId={contact.ownerUserId} members={memberOptions} />
        </Card>

        <Card title="Etichette">
          <TagsEditor slug={slug} contactId={contactId} currentTags={currentTags} availableTags={allTags} />
        </Card>

        <Card title="Origine">
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-2">
              <span style={{ color: "var(--fg-3)" }}>Sorgente</span>
              <span className="truncate" style={{ color: "var(--fg)" }}>{contact.source ?? "—"}</span>
            </div>
            {attribution && UTM_LABELS.filter(u => attribution[u.key]).map(u => (
              <div key={u.key} className="flex justify-between gap-2">
                <span style={{ color: "var(--fg-3)" }}>{u.label}</span>
                <span className="truncate max-w-[60%] text-right" style={{ color: "var(--fg)" }} title={attribution[u.key]}>
                  {attribution[u.key]}
                </span>
              </div>
            ))}
            {(!attribution || UTM_LABELS.every(u => !attribution[u.key])) && !contact.source && (
              <p className="italic" style={{ color: "var(--fg-3)" }}>Nessuna attribuzione registrata</p>
            )}
          </div>
        </Card>

        <Card title="Cliente di fatturazione">
          {contact.client ? (
            <Link
              href={companyPath(slug, `/clients/${contact.client.id}`)}
              className="flex items-center gap-2 text-[13px] hover:underline"
              style={{ color: "var(--info)" }}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              {contact.client.name}
            </Link>
          ) : (
            <p className="text-[12px] italic" style={{ color: "var(--fg-3)" }}>
              Nessun cliente collegato. Crealo dal menu azioni in alto.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
