"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type ContactLifecycle } from "@prisma/client";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { logActivity } from "@/lib/crm/activity";
import { normalizeEmail, setLifecycle, ensureBillingClient } from "@/lib/crm/contacts";
import { normalizePhone } from "@/lib/crm/phone";
import { validateCustomFields } from "@/lib/crm/customFields";
import { getUserPermissions, canEdit } from "@/lib/permissions";

/**
 * Server action della scheda contatto (agente B).
 *
 * Convenzione: invece di lanciare (come le action "da <form action=>" del
 * resto dell'app), queste ritornano `{ ok: true }` o `{ ok: false, error }`.
 * Vengono chiamate direttamente come funzioni async da componenti client con
 * useTransition (non tramite <form action=>), perche' i campi della scheda
 * sono editor inline che devono mostrare l'errore accanto al campo invece di
 * far esplodere tutta la pagina in un error boundary.
 *
 * Ogni action ricarica la pagina con revalidatePath dopo la scrittura.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

function path(slug: string, contactId: string) {
  return `/${slug}/contacts/${contactId}`;
}

// ─── Campi standard di testo semplice ──────────────────────────────────────

const SIMPLE_TEXT_FIELDS = ["firstName", "lastName", "companyName", "jobTitle"] as const;
type SimpleTextField = (typeof SIMPLE_TEXT_FIELDS)[number];

export const updateContactTextField = companyAction(async (
  ctx,
  contactId: string,
  field: SimpleTextField,
  raw: string,
): Promise<ActionResult> => {
  if (!SIMPLE_TEXT_FIELDS.includes(field)) return { ok: false, error: "Campo non valido" };
  const value = raw.trim() || null;

  const current = await ctx.db.contact.findUnique({ where: { id: contactId } });
  if (!current) return { ok: false, error: "Contatto non trovato" };
  if (current[field] === value) return { ok: true };

  await ctx.db.contact.update({ where: { id: contactId }, data: { [field]: value } });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: [field] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Email / telefono (normalizzati, unique per azienda) ───────────────────

export const updateContactEmail = companyAction(async (
  ctx, contactId: string, raw: string,
): Promise<ActionResult> => {
  const trimmed = raw.trim();
  const email = trimmed ? normalizeEmail(trimmed) : null;
  if (trimmed && !email) return { ok: false, error: "Email non valida" };

  const current = await ctx.db.contact.findUnique({ where: { id: contactId }, select: { email: true } });
  if (!current) return { ok: false, error: "Contatto non trovato" };
  if (current.email === email) return { ok: true };

  try {
    await ctx.db.contact.update({ where: { id: contactId }, data: { email } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Email già usata da un altro contatto" };
    }
    throw e;
  }
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: ["email"] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

export const updateContactPhoneField = companyAction(async (
  ctx, contactId: string, field: "phone" | "whatsapp", raw: string,
): Promise<ActionResult> => {
  const trimmed = raw.trim();
  const value = trimmed ? normalizePhone(trimmed) : null;
  if (trimmed && !value) return { ok: false, error: "Numero non valido" };

  const current = await ctx.db.contact.findUnique({ where: { id: contactId } });
  if (!current) return { ok: false, error: "Contatto non trovato" };
  if (current[field] === value) return { ok: true };

  try {
    await ctx.db.contact.update({ where: { id: contactId }, data: { [field]: value } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Telefono già usato da un altro contatto" };
    }
    throw e;
  }
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: [field] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Campi personalizzati ───────────────────────────────────────────────────

export const updateContactCustomField = companyAction(async (
  ctx, contactId: string, key: string, raw: string,
): Promise<ActionResult> => {
  const def = await ctx.db.customFieldDef.findFirst({ where: { entity: "CONTACT", key } });
  if (!def) return { ok: false, error: "Campo non trovato" };

  const result = validateCustomFields([def], { [key]: raw }, { partial: true });
  if (!result.ok) return { ok: false, error: result.errors[key] ?? "Valore non valido" };

  const contact = await ctx.db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return { ok: false, error: "Contatto non trovato" };

  const currentValues = (contact.customFields ?? {}) as Record<string, unknown>;
  const newValue = result.values[key] ?? null;
  if (JSON.stringify(currentValues[key] ?? null) === JSON.stringify(newValue)) return { ok: true };

  const updated = { ...currentValues, [key]: newValue };
  await ctx.db.contact.update({
    where: { id: contactId },
    data: { customFields: updated as Prisma.InputJsonValue },
  });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: [`cf:${key}`] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Responsabile ────────────────────────────────────────────────────────────

export const updateContactOwner = companyAction(async (
  ctx, contactId: string, ownerUserId: string | null,
): Promise<ActionResult> => {
  const current = await ctx.db.contact.findUnique({ where: { id: contactId }, select: { ownerUserId: true } });
  if (!current) return { ok: false, error: "Contatto non trovato" };
  if (current.ownerUserId === ownerUserId) return { ok: true };

  await ctx.db.contact.update({ where: { id: contactId }, data: { ownerUserId } });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: ["ownerUserId"] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Opt-out ─────────────────────────────────────────────────────────────────

export const updateContactOptOut = companyAction(async (
  ctx, contactId: string, field: "emailOptOut" | "whatsappOptOut", value: boolean,
): Promise<ActionResult> => {
  const current = await ctx.db.contact.findUnique({ where: { id: contactId } });
  if (!current) return { ok: false, error: "Contatto non trovato" };
  if (current[field] === value) return { ok: true };

  await ctx.db.contact.update({ where: { id: contactId }, data: { [field]: value } });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "CONTACT_UPDATED", data: { fields: [field] }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Etichette ───────────────────────────────────────────────────────────────

export const addContactTag = companyAction(async (
  ctx, contactId: string, tagId: string,
): Promise<ActionResult> => {
  const tag = await ctx.db.crmTag.findUnique({ where: { id: tagId } });
  if (!tag) return { ok: false, error: "Etichetta non trovata" };

  const existing = await ctx.db.contactTag.findFirst({ where: { contactId, tagId } });
  if (existing) return { ok: true };

  await ctx.db.contactTag.create({ data: { contactId, tagId, companyId: ctx.companyId } });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "TAG_ADDED", data: { tagId, name: tag.name }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

const TAG_PALETTE = ["#4f7deb", "#10b981", "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444"];

export const createAndAddContactTag = companyAction(async (
  ctx, contactId: string, rawName: string,
): Promise<ActionResult> => {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "Nome etichetta obbligatorio" };
  if (name.length > 40) return { ok: false, error: "Nome etichetta troppo lungo" };

  let tag = await ctx.db.crmTag.findFirst({ where: { name } });
  if (!tag) {
    try {
      const color = TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)];
      tag = await ctx.db.crmTag.create({ data: { companyId: ctx.companyId, name, color } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        tag = await ctx.db.crmTag.findFirst({ where: { name } });
      } else {
        throw e;
      }
    }
  }
  if (!tag) return { ok: false, error: "Impossibile creare l'etichetta" };

  const existing = await ctx.db.contactTag.findFirst({ where: { contactId, tagId: tag.id } });
  if (!existing) {
    await ctx.db.contactTag.create({ data: { contactId, tagId: tag.id, companyId: ctx.companyId } });
    await logActivity(ctx.db, ctx.companyId, {
      contactId, type: "TAG_ADDED", data: { tagId: tag.id, name: tag.name }, actorUserId: ctx.userId,
    });
  }
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

export const removeContactTag = companyAction(async (
  ctx, contactId: string, tagId: string,
): Promise<ActionResult> => {
  const ct = await ctx.db.contactTag.findFirst({ where: { contactId, tagId }, include: { tag: true } });
  if (!ct) return { ok: true };

  await ctx.db.contactTag.delete({ where: { id: ct.id } });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "TAG_REMOVED", data: { tagId, name: ct.tag.name }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

// ─── Ciclo di vita / cliente di fatturazione / eliminazione ────────────────

export const changeContactLifecycle = companyAction(async (
  ctx, contactId: string, to: ContactLifecycle,
): Promise<ActionResult> => {
  await setLifecycle(ctx.db, ctx.companyId, contactId, to, ctx.userId);
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

export const createBillingClientForContact = companyAction(async (
  ctx, contactId: string,
): Promise<ActionResult & { clientId?: string }> => {
  try {
    const client = await ensureBillingClient(ctx.db, ctx.companyId, contactId, ctx.userId);
    revalidatePath(path(ctx.slug, contactId));
    return { ok: true, clientId: client.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore imprevisto" };
  }
});

export const deleteContact = companyAction(async (ctx, contactId: string): Promise<ActionResult> => {
  const contact = await ctx.db.contact.findUnique({
    where: { id: contactId },
    include: { client: { include: { invoices: { select: { id: true }, take: 1 } } } },
  });
  if (!contact) return { ok: false, error: "Contatto non trovato" };

  if (contact.client && contact.client.invoices.length > 0) {
    return {
      ok: false,
      error:
        "Il contatto è collegato al cliente di fatturazione " +
        `"${contact.client.name}", che ha già delle fatture emesse. ` +
        "Eliminarlo spezzerebbe lo storico contabile: scollega prima il cliente " +
        "(dal modulo Clienti) oppure conserva il contatto.",
    };
  }

  await ctx.db.contact.delete({ where: { id: contactId } });
  revalidatePath(`/${ctx.slug}/contacts`);
  return { ok: true };
});

// ─── Note ────────────────────────────────────────────────────────────────────

/**
 * Whitelist di tag semplice per l'HTML delle note (niente librerie nuove).
 * Rimuove script/style/commenti, scarta ogni tag non in whitelist (tenendo il
 * testo dentro), e su <a> tiene solo un href http(s)/mailto validato — cosi'
 * anche un "on*" o uno stile inline arrivato per errore dall'editor sparisce,
 * perche' NESSUN attributo sopravvive tranne quell'href ricostruito a mano.
 */
const NOTE_ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "blockquote", "code", "h1", "h2", "h3",
]);

function sanitizeNoteHtml(html: string): string {
  let out = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagRaw: string, attrsRaw: string) => {
    const tag = String(tagRaw).toLowerCase();
    const isClosing = match.startsWith("</");
    if (!NOTE_ALLOWED_TAGS.has(tag)) return "";
    if (isClosing) return `</${tag}>`;
    if (tag === "a") {
      const hrefMatch = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(attrsRaw);
      const href = (hrefMatch ? hrefMatch[1] ?? hrefMatch[2] : "") ?? "";
      const safeHref = /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : "";
      return safeHref ? `<a href="${safeHref.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer nofollow">` : "<a>";
    }
    return `<${tag}>`;
  });
  return out.trim();
}

function htmlToPreview(html: string, max = 140): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export const addContactNote = companyAction(async (
  ctx, contactId: string, html: string,
): Promise<ActionResult> => {
  const clean = sanitizeNoteHtml(html);
  const preview = htmlToPreview(clean);
  if (!preview) return { ok: false, error: "La nota è vuota" };

  const note = await ctx.db.note.create({
    data: { companyId: ctx.companyId, contactId, authorUserId: ctx.userId, body: clean },
  });
  await logActivity(ctx.db, ctx.companyId, {
    contactId, type: "NOTE_ADDED", data: { noteId: note.id, preview }, actorUserId: ctx.userId,
  });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

/**
 * Puo' modificare/eliminare una nota il suo autore, oppure chi ha permesso
 * EDIT sulla sezione CONTATTI (i responsabili/owner che devono poter
 * correggere o rimuovere una nota lasciata da un collega). Chi ha solo VIEW
 * non puo' toccare le note altrui.
 */
async function canTouchNote(ctx: CompanyContext, authorUserId: string | null): Promise<boolean> {
  if (authorUserId === ctx.userId) return true;
  const perms = await getUserPermissions(ctx.db, ctx.companyId, ctx.userId);
  return canEdit(perms, "CONTACTS");
}

export const updateContactNote = companyAction(async (
  ctx, contactId: string, noteId: string, html: string,
): Promise<ActionResult> => {
  const note = await ctx.db.note.findUnique({ where: { id: noteId } });
  if (!note || note.contactId !== contactId) return { ok: false, error: "Nota non trovata" };
  if (!(await canTouchNote(ctx, note.authorUserId))) {
    return { ok: false, error: "Non hai il permesso di modificare questa nota" };
  }

  const clean = sanitizeNoteHtml(html);
  const preview = htmlToPreview(clean);
  if (!preview) return { ok: false, error: "La nota è vuota" };

  await ctx.db.note.update({ where: { id: noteId }, data: { body: clean } });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

export const deleteContactNote = companyAction(async (
  ctx, contactId: string, noteId: string,
): Promise<ActionResult> => {
  const note = await ctx.db.note.findUnique({ where: { id: noteId } });
  if (!note || note.contactId !== contactId) return { ok: true };
  if (!(await canTouchNote(ctx, note.authorUserId))) {
    return { ok: false, error: "Non hai il permesso di eliminare questa nota" };
  }

  await ctx.db.note.delete({ where: { id: noteId } });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});

export const toggleContactNotePin = companyAction(async (
  ctx, contactId: string, noteId: string, pinned: boolean,
): Promise<ActionResult> => {
  const note = await ctx.db.note.findUnique({ where: { id: noteId } });
  if (!note || note.contactId !== contactId) return { ok: false, error: "Nota non trovata" };

  await ctx.db.note.update({ where: { id: noteId }, data: { pinned } });
  revalidatePath(path(ctx.slug, contactId));
  return { ok: true };
});
