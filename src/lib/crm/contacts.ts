import "server-only";
import { Prisma, type Contact, type ContactLifecycle } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { logActivity } from "./activity";
import { normalizePhone } from "./phone";
import { secureToken } from "./tokens";
import type { Attribution } from "./types";
import type { CustomFieldValues } from "./customFields";

export { normalizePhone } from "./phone";

export function normalizeEmail(raw: string | null | undefined): string | null {
  const s = raw?.trim().toLowerCase();
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function contactDisplayName(c: Pick<Contact, "firstName" | "lastName" | "email" | "phone" | "companyName">): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.companyName || c.email || c.phone || "Senza nome";
}

export type UpsertContactInput = {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  attribution?: Attribution | null;
  /** Gia' validati con validateCustomFields() */
  customFields?: CustomFieldValues;
};

/**
 * Trova o crea il contatto per email (poi telefono). Usato da form pubblici,
 * booking, WhatsApp/email in entrata, import CSV.
 *
 * Regole di merge su un contatto esistente:
 *  - i campi standard vengono riempiti solo se vuoti (non si sovrascrive un
 *    nome corretto a mano con quello digitato in un form);
 *  - i custom field in ingresso vincono (sono la risposta piu' recente);
 *  - l'attribuzione resta quella del PRIMO contatto (first touch).
 *
 * Due richieste concorrenti con la stessa email: la seconda create fallisce
 * sull'unique (companyId, email) e si ripiega sul contatto appena creato.
 */
export async function upsertContact(
  db: CompanyDb,
  companyId: string,
  input: UpsertContactInput,
  opts: {
    actorUserId?: string | null;
    /**
     * Dati da un canale pubblico non autenticato (form, prenotazione): chiunque
     * puo' digitare l'email di un cliente vero. Su un contatto ESISTENTE si
     * riempiono solo nome/cognome/azienda/ruolo mancanti e i campi personalizzati
     * ancora vuoti; recapiti (email/telefono/WhatsApp), responsabile e stato non
     * si toccano, cosi' nessuno puo' dirottare i messaggi del CRM verso il
     * proprio numero. I valori proposti restano comunque nella FormSubmission.
     */
    untrusted?: boolean;
  } = {},
): Promise<{ contact: Contact; created: boolean }> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const whatsapp = normalizePhone(input.whatsapp);
  if (!email && !phone && !whatsapp) throw new Error("Serve almeno email o telefono per identificare il contatto");

  const find = async () =>
    (email ? await db.contact.findFirst({ where: { email } }) : null)
    ?? (phone ? await db.contact.findFirst({ where: { phone } }) : null)
    ?? (whatsapp ? await db.contact.findFirst({ where: { OR: [{ whatsapp }, { phone: whatsapp }] } }) : null);

  const existing = await find();
  if (existing) return { contact: await mergeInto(db, existing, { ...input, email, phone, whatsapp }, !!opts.untrusted), created: false };

  try {
    const contact = await db.contact.create({
      data: {
        companyId,
        email,
        phone: phone ?? whatsapp,
        whatsapp,
        firstName: clean(input.firstName),
        lastName: clean(input.lastName),
        companyName: clean(input.companyName),
        jobTitle: clean(input.jobTitle),
        source: input.source ?? null,
        ownerUserId: input.ownerUserId ?? null,
        attribution: input.attribution ? (input.attribution as Prisma.InputJsonValue) : Prisma.JsonNull,
        customFields: (input.customFields ?? {}) as Prisma.InputJsonValue,
        replyToken: secureToken(),
      },
    });
    await logActivity(db, companyId, {
      contactId: contact.id,
      type: "CONTACT_CREATED",
      data: { source: input.source ?? undefined },
      actorUserId: opts.actorUserId,
    });
    return { contact, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await find();
      if (again) return { contact: await mergeInto(db, again, { ...input, email, phone, whatsapp }, !!opts.untrusted), created: false };
      // Esiste ma non e' visibile a questo utente ("Solo assegnati"): non si
      // rivela di chi e', si dice solo che c'e'.
      throw new Error("Esiste già un contatto con questa email o telefono, assegnato a un altro utente");
    }
    throw e;
  }
}

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

async function mergeInto(db: CompanyDb, c: Contact, input: UpsertContactInput, untrusted: boolean): Promise<Contact> {
  const data: Prisma.ContactUpdateInput = {};
  const fill = <K extends "email" | "phone" | "whatsapp" | "firstName" | "lastName" | "companyName" | "jobTitle">(k: K) => {
    const v = clean(input[k] as string | null | undefined);
    if (v && !c[k]) data[k] = v;
  };
  const fields = untrusted
    ? (["firstName", "lastName", "companyName", "jobTitle"] as const)
    : (["email", "phone", "whatsapp", "firstName", "lastName", "companyName", "jobTitle"] as const);
  fields.forEach(fill);
  if (!untrusted && !c.ownerUserId && input.ownerUserId) data.ownerUserId = input.ownerUserId;
  if (!c.attribution && input.attribution) data.attribution = input.attribution as Prisma.InputJsonValue;
  if (input.customFields && Object.keys(input.customFields).length) {
    const current = (c.customFields ?? {}) as Record<string, unknown>;
    const incoming = untrusted
      ? Object.fromEntries(Object.entries(input.customFields).filter(([k]) => current[k] === undefined || current[k] === null || current[k] === ""))
      : input.customFields;
    if (Object.keys(incoming).length) data.customFields = { ...current, ...incoming } as Prisma.InputJsonValue;
  }
  // un archiviato che torna a farsi vivo e' di nuovo un lead (solo da canali fidati)
  if (!untrusted && c.lifecycle === "ARCHIVED") data.lifecycle = "LEAD";
  if (!Object.keys(data).length) return c;
  try {
    return await db.contact.update({ where: { id: c.id }, data });
  } catch (e) {
    // email/telefono gia' usati da un altro contatto: si aggiorna il resto
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      delete data.email; delete data.phone;
      return db.contact.update({ where: { id: c.id }, data });
    }
    throw e;
  }
}

/** Cambia il ciclo di vita registrando l'attivita'. No-op se invariato. */
export async function setLifecycle(
  db: CompanyDb,
  companyId: string,
  contactId: string,
  to: ContactLifecycle,
  actorUserId?: string | null,
) {
  const c = await db.contact.findUnique({ where: { id: contactId }, select: { lifecycle: true } });
  if (!c || c.lifecycle === to) return;
  await db.contact.update({ where: { id: contactId }, data: { lifecycle: to } });
  await logActivity(db, companyId, {
    contactId,
    type: "LIFECYCLE_CHANGED",
    data: { from: c.lifecycle, to },
    actorUserId,
  });
}

/**
 * Collega (o crea) il Client di fatturazione per un contatto e lo porta a
 * CUSTOMER. Usato da "Crea cliente di fatturazione" e da "Opportunita' vinta".
 * Il Client richiede un'email: senza email del contatto lancia un errore
 * leggibile.
 */
export async function ensureBillingClient(
  db: CompanyDb,
  companyId: string,
  contactId: string,
  actorUserId?: string | null,
) {
  const contact = await db.contact.findUnique({ where: { id: contactId }, include: { client: true } });
  if (!contact) throw new Error("Contatto non trovato");
  if (contact.client) return contact.client;
  if (!contact.email) throw new Error("Per creare il cliente di fatturazione serve l'email del contatto");

  const byEmail = await db.client.findFirst({ where: { email: contact.email, contactId: null } });
  const client = byEmail
    ? await db.client.update({ where: { id: byEmail.id }, data: { contactId } })
    : await db.client.create({
        data: {
          companyId,
          contactId,
          name: contactDisplayName(contact),
          email: contact.email,
          phone: contact.phone,
          whatsapp: contact.whatsapp,
          company: contact.companyName,
        },
      });
  await logActivity(db, companyId, { contactId, type: "CLIENT_LINKED", data: { clientId: client.id }, actorUserId });
  await setLifecycle(db, companyId, contactId, "CUSTOMER", actorUserId);
  return client;
}
