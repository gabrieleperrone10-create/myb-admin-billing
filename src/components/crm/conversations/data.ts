import "server-only";
import type { MessageChannel, MessageDirection, MessageStatus } from "@prisma/client";
import type { CompanyContext } from "@/lib/company";
import { contactDisplayName } from "@/lib/crm/contacts";
import { listCompanyMembers, memberName } from "@/lib/crm/members";
import { getWhatsAppConfig, lastInboundWhatsAppAt, SERVICE_WINDOW_MS } from "@/lib/crm/messaging/whatsapp";
import { canEdit, canView, getUserPermissions } from "@/lib/permissions";
import { htmlToText } from "@/lib/crm/messaging/signatures";

/** Tutto serializzabile: passa ai Client Component. */
export type ThreadMessage = {
  id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  subject: string | null;
  text: string;
  /** Solo email; mostrato in un iframe sandbox senza script */
  html: string | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  attachments: string[];
  sentBy: string | null;
  template: string | null;
};

export type ChannelState = { enabled: boolean; reason?: string };

export type ConversationData = {
  contactId: string;
  name: string;
  email: string | null;
  whatsappNumber: string | null;
  unreadCount: number;
  canView: boolean;
  canSend: boolean;
  channels: {
    EMAIL: ChannelState;
    WHATSAPP: ChannelState & { insideWindow: boolean; windowEndsAt: string | null };
  };
  messages: ThreadMessage[];
};

const MAX_MESSAGES = 200;
const MAX_HTML = 200_000;

function attachmentLabels(raw: unknown): { labels: string[]; template: string | null } {
  if (!raw || typeof raw !== "object") return { labels: [], template: null };
  if (Array.isArray(raw)) {
    return {
      labels: raw.map(a => (a && typeof a === "object" && "filename" in a ? String((a as { filename: unknown }).filename ?? "allegato") : "allegato")),
      template: null,
    };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.template === "string") return { labels: [], template: o.template };
  if (typeof o.filename === "string") return { labels: [o.filename], template: null };
  return { labels: [], template: null };
}

export async function loadConversation(ctx: CompanyContext, contactId: string): Promise<ConversationData | null> {
  const { db, companyId } = ctx;
  const perms = await getUserPermissions(db, companyId, ctx.userId);
  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, whatsapp: true, companyName: true,
      emailOptOut: true, whatsappOptOut: true, unreadCount: true,
    },
  });
  if (!contact) return null;

  const allowedView = canView(perms, "CONVERSATIONS");
  const base = {
    contactId: contact.id,
    name: contactDisplayName(contact),
    email: contact.email,
    whatsappNumber: contact.whatsapp ?? contact.phone,
    unreadCount: contact.unreadCount,
    canView: allowedView,
    canSend: allowedView && canEdit(perms, "CONVERSATIONS"),
  };
  if (!allowedView) {
    return {
      ...base,
      channels: { EMAIL: { enabled: false }, WHATSAPP: { enabled: false, insideWindow: false, windowEndsAt: null } },
      messages: [],
    };
  }

  const [rows, waConfig, lastInbound, members] = await Promise.all([
    db.message.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: MAX_MESSAGES,
    }),
    getWhatsAppConfig(companyId),
    lastInboundWhatsAppAt(db, contactId),
    listCompanyMembers(companyId).catch(() => []),
  ]);

  const emailState: ChannelState = !process.env.RESEND_API_KEY
    ? { enabled: false, reason: "Invio email non configurato sul server (RESEND_API_KEY)" }
    : !contact.email
      ? { enabled: false, reason: "Il contatto non ha un indirizzo email" }
      : contact.emailOptOut
        ? { enabled: false, reason: "Il contatto ha chiesto di non ricevere email" }
        : { enabled: true };

  const windowEnds = lastInbound ? new Date(lastInbound.getTime() + SERVICE_WINDOW_MS) : null;
  const insideWindow = !!windowEnds && windowEnds.getTime() > Date.now();
  const waState: ChannelState = !waConfig
    ? { enabled: false, reason: "WhatsApp non configurato: Impostazioni › Integrazioni › WhatsApp" }
    : !(contact.whatsapp ?? contact.phone)
      ? { enabled: false, reason: "Il contatto non ha un numero WhatsApp o di telefono" }
      : contact.whatsappOptOut
        ? { enabled: false, reason: "Il contatto ha chiesto di non ricevere messaggi WhatsApp" }
        : { enabled: true };

  const messages: ThreadMessage[] = rows.reverse().map(m => {
    const { labels, template } = attachmentLabels(m.attachments);
    const html = m.channel === "EMAIL" && m.bodyHtml && m.bodyHtml.length <= MAX_HTML ? m.bodyHtml : null;
    return {
      id: m.id,
      channel: m.channel,
      direction: m.direction,
      status: m.status,
      subject: m.subject,
      text: m.bodyText ?? (m.bodyHtml ? htmlToText(m.bodyHtml) : ""),
      html,
      error: m.error,
      createdAt: m.createdAt.toISOString(),
      deliveredAt: m.deliveredAt?.toISOString() ?? null,
      readAt: m.readAt?.toISOString() ?? null,
      openedAt: m.openedAt?.toISOString() ?? null,
      clickedAt: m.clickedAt?.toISOString() ?? null,
      attachments: labels,
      sentBy: memberName(members, m.sentByUserId),
      template,
    };
  });

  return {
    ...base,
    channels: {
      EMAIL: emailState,
      WHATSAPP: { ...waState, insideWindow, windowEndsAt: windowEnds?.toISOString() ?? null },
    },
    messages,
  };
}
