"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { canEdit, canView, getEffectivePermissions } from "@/lib/permissions";
import { sendContactEmail } from "@/lib/crm/messaging/email";
import {
  listWhatsAppTemplates,
  renderTemplateBody,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type WhatsAppTemplate,
} from "@/lib/crm/messaging/whatsapp";
import { htmlToText, plainTextToHtml } from "@/lib/crm/messaging/signatures";

/**
 * Azioni della conversazione (scheda contatto e casella /conversations).
 *
 * Ogni export e' un endpoint POST pubblico: membership via companyAction +
 * permesso sulla sezione Conversazioni (EDIT per inviare, VIEW per leggere).
 * Il contactId arriva dal client ed e' input non fidato: le funzioni di
 * lib/crm/messaging lo cercano con ctx.db, filtrato per azienda, quindi un id
 * di un'altra azienda risulta "Contatto non trovato".
 */

type Result = { ok: true } | { ok: false; error: string };

async function assertPerm(ctx: CompanyContext, level: "view" | "edit") {
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);
  const allowed = level === "edit" ? canEdit(perms, "CONVERSATIONS") : canView(perms, "CONVERSATIONS");
  if (!allowed) throw new Error("Permessi insufficienti sulle conversazioni");
}

function revalidateConversation(slug: string, contactId: string) {
  revalidatePath(`/${slug}/contacts/${contactId}`);
  revalidatePath(`/${slug}/conversations`);
}

const Id = z.string().min(1).max(64);

const EmailSchema = z.object({
  contactId: Id,
  subject: z.string().trim().min(1, "Oggetto obbligatorio").max(300),
  body: z.string().trim().min(1, "Il messaggio e' vuoto").max(100_000),
  format: z.enum(["text", "html"]),
});

export const sendConversationEmail = companyAction(async (ctx, input: z.input<typeof EmailSchema>): Promise<Result> => {
  await assertPerm(ctx, "edit");
  const p = EmailSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dati non validi" };
  const { contactId, subject, body, format } = p.data;

  const html =
    format === "html"
      ? `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="font-family:sans-serif;color:#111827;font-size:14px;">${body}</body></html>`
      : plainTextToHtml(body);
  const text = format === "html" ? htmlToText(body) : body;

  const res = await sendContactEmail(ctx.db, ctx.companyId, { contactId, subject, html, text, sentByUserId: ctx.userId });
  revalidateConversation(ctx.slug, contactId);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
});

const WaTextSchema = z.object({ contactId: Id, text: z.string().trim().min(1, "Il messaggio e' vuoto").max(4096) });

export const sendConversationWhatsApp = companyAction(async (ctx, input: z.input<typeof WaTextSchema>): Promise<Result> => {
  await assertPerm(ctx, "edit");
  const p = WaTextSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dati non validi" };
  const res = await sendWhatsAppText(ctx.db, ctx.companyId, { ...p.data, sentByUserId: ctx.userId });
  revalidateConversation(ctx.slug, p.data.contactId);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
});

const WaTemplateSchema = z.object({
  contactId: Id,
  templateName: z.string().min(1).max(512),
  language: z.string().min(2).max(15),
  bodyParams: z.array(z.string().trim().min(1, "Compila tutti i parametri").max(1024)).max(20),
});

export const sendConversationWhatsAppTemplate = companyAction(
  async (ctx, input: z.input<typeof WaTemplateSchema>): Promise<Result> => {
    await assertPerm(ctx, "edit");
    const p = WaTemplateSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dati non validi" };
    const v = p.data;

    // Si rilegge il template dal WABA: nome/lingua arrivano dal client e il
    // testo salvato nel thread deve essere quello vero.
    let templates: WhatsAppTemplate[];
    try {
      templates = await listWhatsAppTemplates(ctx.companyId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Impossibile leggere i template" };
    }
    const tpl = templates.find(t => t.name === v.templateName && t.language === v.language);
    if (!tpl) return { ok: false, error: "Template non trovato o non approvato" };
    if (tpl.paramCount !== v.bodyParams.length) return { ok: false, error: `Il template richiede ${tpl.paramCount} parametri` };

    const res = await sendWhatsAppTemplate(ctx.db, ctx.companyId, {
      contactId: v.contactId,
      templateName: tpl.name,
      language: tpl.language,
      bodyParams: v.bodyParams,
      renderedText: renderTemplateBody(tpl.bodyText, v.bodyParams) || `[Template ${tpl.name}]`,
      sentByUserId: ctx.userId,
    });
    revalidateConversation(ctx.slug, v.contactId);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  },
);

export const getConversationTemplates = companyAction(
  async (ctx): Promise<{ ok: true; templates: WhatsAppTemplate[] } | { ok: false; error: string }> => {
    await assertPerm(ctx, "edit");
    try {
      return { ok: true, templates: await listWhatsAppTemplates(ctx.companyId) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Impossibile leggere i template" };
    }
  },
);

/** Azzera i non letti quando la conversazione viene aperta. */
export const markConversationRead = companyAction(async (ctx, contactId: string): Promise<Result> => {
  await assertPerm(ctx, "view");
  if (!Id.safeParse(contactId).success) return { ok: false, error: "Contatto non valido" };
  const { count } = await ctx.db.contact.updateMany({
    where: { id: contactId, unreadCount: { gt: 0 } },
    data: { unreadCount: 0 },
  });
  if (count) revalidateConversation(ctx.slug, contactId);
  return { ok: true };
});
