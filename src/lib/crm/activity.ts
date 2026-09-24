import "server-only";
import type { ActivityType, Prisma } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import type { ActivityData } from "./types";

/**
 * Unico punto di scrittura della cronologia del contatto.
 *
 * Tipizzato per `type`: `data` deve avere la forma definita in
 * lib/crm/types.ts ActivityData, quindi la timeline puo' leggerla senza
 * controlli difensivi. Aggiorna anche Contact.lastActivityAt, che ordina la
 * lista contatti ("attivita' recente").
 *
 * `db` e' sempre un client filtrato per azienda (requireCompany() o
 * companyDb(companyId) nelle rotte pubbliche/webhook): companyId viene
 * stampato dall'estensione, qui serve solo per il tipo di create.
 */
export async function logActivity<T extends ActivityType>(
  db: CompanyDb,
  companyId: string,
  params: {
    contactId: string;
    type: T;
    data: ActivityData[T];
    opportunityId?: string | null;
    actorUserId?: string | null;
    occurredAt?: Date;
  },
) {
  const occurredAt = params.occurredAt ?? new Date();
  const activity = await db.activity.create({
    data: {
      companyId,
      contactId: params.contactId,
      type: params.type,
      data: params.data as Prisma.InputJsonValue,
      opportunityId: params.opportunityId ?? null,
      actorUserId: params.actorUserId ?? null,
      occurredAt,
    },
  });
  // updateMany: non fallisce se nel frattempo il contatto e' stato eliminato,
  // e la condizione evita di "tornare indietro" con eventi retrodatati.
  await db.contact.updateMany({
    where: { id: params.contactId, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: occurredAt } }] },
    data: { lastActivityAt: occurredAt },
  });
  return activity;
}
