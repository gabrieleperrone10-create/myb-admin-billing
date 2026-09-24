import "server-only";
import type { CompanyDb } from "@/lib/db";
import { logActivity } from "@/lib/crm/activity";

/**
 * Collega le PageView anonime di un visitorId a un contatto appena
 * identificato (invio form, prenotazione booking, ...).
 *
 * Chiamata da: submit dei form pubblici (questo agente) e dal booking
 * pubblico (altro agente) — firma condivisa, non toccarla senza coordinarsi.
 *
 * - Aggiorna TUTTE le PageView anonime di quel visitorId (contactId sempre
 *   coerente, anche oltre le 50 registrate in cronologia).
 * - Scrive un'attivita' PAGE_VIEW in cronologia solo per le ultime 50 (piu'
 *   di cosi' sommergerebbe la timeline di un contatto con molte visite
 *   pregresse) con occurredAt = l'orario reale della visita, non "adesso".
 * - Idempotente: una seconda chiamata sullo stesso visitorId/contactId non
 *   trova piu' righe con contactId nullo e non fa nulla.
 *
 * Le scritture sono sequenziali (non Promise.all) apposta: ognuna passa da
 * logActivity(), che a sua volta fa un updateMany su Contact — girarle in
 * parallelo moltiplicherebbe la contesa senza benefici reali qui (evento
 * raro, poche decine di righe).
 */
export async function identifyVisitor(
  db: CompanyDb,
  companyId: string,
  visitorId: string | null | undefined,
  contactId: string,
): Promise<void> {
  if (!visitorId) return;

  const anonymous = await db.pageView.findMany({
    where: { visitorId, contactId: null },
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: { id: true, url: true, title: true, occurredAt: true },
  });

  await db.pageView.updateMany({
    where: { visitorId, contactId: null },
    data: { contactId },
  });

  if (anonymous.length === 0) return;

  for (const pv of anonymous.reverse()) {
    await logActivity(db, companyId, {
      contactId,
      type: "PAGE_VIEW",
      data: { pageViewId: pv.id, url: pv.url, title: pv.title ?? undefined },
      occurredAt: pv.occurredAt,
    });
  }
}
