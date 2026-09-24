import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/db";
import type { FormField, FormSettings } from "@/lib/crm/types";
import { PublicForm } from "@/components/crm/forms/PublicForm";

/**
 * Pagina pubblica del form: nessuna sessione (src/proxy.ts la rende pubblica,
 * "f" e' fra i RESERVED_SLUGS in src/lib/company.ts cosi' nessuna azienda puo'
 * avere uno slug che la ombreggi). Deve funzionare sia in visita diretta sia
 * incorporata in un iframe su un sito di terzi: niente header che blocchino
 * l'embedding (next.config.ts di questo progetto non imposta X-Frame-Options
 * ne' una CSP frame-ancestors, verificato).
 *
 * basePrisma: risolve il form da un identificativo pubblico (l'id nell'URL,
 * non fidato — chiunque puo' scrivere /f/<qualunque-cosa>). Non serve
 * companyDb qui: e' una lettura sola, gia' scoped a mano su form.companyId,
 * senza alcuna scrittura da isolare fra aziende.
 */
export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;

  const form = await basePrisma.form.findUnique({ where: { id: formId } });
  if (!form || !form.active) notFound();

  const company = await basePrisma.company.findUnique({
    where: { id: form.companyId },
    select: { name: true, brandName: true, logoUrl: true, brandColor: true },
  });
  if (!company) notFound();

  return (
    <PublicForm
      formId={form.id}
      name={form.name}
      fields={(form.fields ?? []) as unknown as FormField[]}
      settings={(form.settings ?? {}) as unknown as FormSettings}
      brand={{
        name: company.brandName || company.name,
        logoUrl: company.logoUrl,
        color: company.brandColor,
      }}
    />
  );
}
