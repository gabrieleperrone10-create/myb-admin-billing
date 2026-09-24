import type { Activity, ActivityType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  UserPlus, UserCog, Repeat, Tag, StickyNote, Eye, FileText, Mail, MailOpen,
  MailWarning, MousePointerClick, MessageCircle, Calendar, CalendarClock,
  CalendarX, CalendarCheck, CalendarOff, Target, TrendingUp, TrendingDown, Link2,
} from "lucide-react";
import type { ActivityData } from "@/lib/crm/types";
import { formatCurrency } from "@/lib/utils";

const LIFECYCLE_LABEL: Record<string, string> = { LEAD: "Lead", CUSTOMER: "Cliente", ARCHIVED: "Archiviato" };

/** Etichette italiane dei campi standard per il riepilogo di CONTACT_UPDATED. */
export const STANDARD_FIELD_LABEL: Record<string, string> = {
  firstName: "Nome", lastName: "Cognome", email: "Email", phone: "Telefono",
  whatsapp: "WhatsApp", companyName: "Azienda", jobTitle: "Ruolo",
  ownerUserId: "Responsabile", emailOptOut: "Opt-out email", whatsappOptOut: "Opt-out WhatsApp",
};

export type ActivityIcon = { Icon: LucideIcon; color: string };

const ICONS: Record<ActivityType, ActivityIcon> = {
  CONTACT_CREATED: { Icon: UserPlus, color: "var(--info)" },
  CONTACT_UPDATED: { Icon: UserCog, color: "var(--fg-3)" },
  LIFECYCLE_CHANGED: { Icon: Repeat, color: "var(--warn)" },
  TAG_ADDED: { Icon: Tag, color: "var(--fg-3)" },
  TAG_REMOVED: { Icon: Tag, color: "var(--fg-3)" },
  NOTE_ADDED: { Icon: StickyNote, color: "var(--warn)" },
  PAGE_VIEW: { Icon: Eye, color: "var(--fg-3)" },
  FORM_SUBMITTED: { Icon: FileText, color: "var(--info)" },
  EMAIL_SENT: { Icon: Mail, color: "var(--info)" },
  EMAIL_RECEIVED: { Icon: Mail, color: "var(--info)" },
  EMAIL_OPENED: { Icon: MailOpen, color: "var(--info)" },
  EMAIL_CLICKED: { Icon: MousePointerClick, color: "var(--info)" },
  EMAIL_BOUNCED: { Icon: MailWarning, color: "var(--danger)" },
  WHATSAPP_SENT: { Icon: MessageCircle, color: "var(--ok)" },
  WHATSAPP_RECEIVED: { Icon: MessageCircle, color: "var(--ok)" },
  APPOINTMENT_BOOKED: { Icon: Calendar, color: "var(--info)" },
  APPOINTMENT_RESCHEDULED: { Icon: CalendarClock, color: "var(--warn)" },
  APPOINTMENT_CANCELLED: { Icon: CalendarX, color: "var(--danger)" },
  APPOINTMENT_COMPLETED: { Icon: CalendarCheck, color: "var(--ok)" },
  APPOINTMENT_NO_SHOW: { Icon: CalendarOff, color: "var(--danger)" },
  OPPORTUNITY_CREATED: { Icon: Target, color: "var(--info)" },
  OPPORTUNITY_STAGE_CHANGED: { Icon: Target, color: "var(--fg-3)" },
  OPPORTUNITY_WON: { Icon: TrendingUp, color: "var(--ok)" },
  OPPORTUNITY_LOST: { Icon: TrendingDown, color: "var(--danger)" },
  CLIENT_LINKED: { Icon: Link2, color: "var(--ok)" },
};

export function activityIcon(type: ActivityType): ActivityIcon {
  return ICONS[type];
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Testo leggibile per una riga di cronologia, costruito da `Activity.data`
 * (tipizzato per `type` in lib/crm/types.ts ActivityData). `fieldLabels`
 * mappa sia i campi standard sia `cf:<key>` (custom field) alle etichette
 * italiane, per il riepilogo di CONTACT_UPDATED.
 */
export function describeActivity(
  activity: Pick<Activity, "type" | "data">,
  fieldLabels: Record<string, string>,
): { title: string; detail?: string } {
  const type = activity.type;
  const data = activity.data as ActivityData[typeof type];

  switch (type) {
    case "CONTACT_CREATED": {
      const d = data as ActivityData["CONTACT_CREATED"];
      return { title: "Contatto creato", detail: d.source ? `Origine: ${d.source}` : undefined };
    }
    case "CONTACT_UPDATED": {
      const d = data as ActivityData["CONTACT_UPDATED"];
      const labels = d.fields.map(f => fieldLabels[f] ?? f);
      return { title: "Contatto aggiornato", detail: labels.join(", ") };
    }
    case "LIFECYCLE_CHANGED": {
      const d = data as ActivityData["LIFECYCLE_CHANGED"];
      return { title: `Cambio stato: ${LIFECYCLE_LABEL[d.from] ?? d.from} → ${LIFECYCLE_LABEL[d.to] ?? d.to}` };
    }
    case "TAG_ADDED": {
      const d = data as ActivityData["TAG_ADDED"];
      return { title: `Etichetta aggiunta: ${d.name}` };
    }
    case "TAG_REMOVED": {
      const d = data as ActivityData["TAG_REMOVED"];
      return { title: `Etichetta rimossa: ${d.name}` };
    }
    case "NOTE_ADDED": {
      const d = data as ActivityData["NOTE_ADDED"];
      return { title: "Nota aggiunta", detail: d.preview };
    }
    case "PAGE_VIEW": {
      const d = data as ActivityData["PAGE_VIEW"];
      return { title: "Pagina visitata", detail: d.title || d.url };
    }
    case "FORM_SUBMITTED": {
      const d = data as ActivityData["FORM_SUBMITTED"];
      return { title: `Form compilato — ${d.formName}` };
    }
    case "EMAIL_SENT": {
      const d = data as ActivityData["EMAIL_SENT"];
      return { title: "Email inviata", detail: d.subject };
    }
    case "EMAIL_RECEIVED": {
      const d = data as ActivityData["EMAIL_RECEIVED"];
      return { title: "Email ricevuta", detail: d.subject };
    }
    case "EMAIL_OPENED": {
      const d = data as ActivityData["EMAIL_OPENED"];
      return { title: "Email aperta", detail: d.subject };
    }
    case "EMAIL_CLICKED": {
      const d = data as ActivityData["EMAIL_CLICKED"];
      return { title: "Link cliccato", detail: d.url ?? d.subject };
    }
    case "EMAIL_BOUNCED": {
      const d = data as ActivityData["EMAIL_BOUNCED"];
      return { title: "Email non recapitata", detail: d.reason };
    }
    case "WHATSAPP_SENT": {
      const d = data as ActivityData["WHATSAPP_SENT"];
      return { title: "WhatsApp inviato", detail: d.preview ?? d.template };
    }
    case "WHATSAPP_RECEIVED": {
      const d = data as ActivityData["WHATSAPP_RECEIVED"];
      return { title: "WhatsApp ricevuto", detail: d.preview };
    }
    case "APPOINTMENT_BOOKED": {
      const d = data as ActivityData["APPOINTMENT_BOOKED"];
      return { title: "Appuntamento prenotato", detail: `${fmtDateTime(d.startTime)} · ${d.calendarName}` };
    }
    case "APPOINTMENT_RESCHEDULED": {
      const d = data as ActivityData["APPOINTMENT_RESCHEDULED"];
      return { title: "Appuntamento spostato", detail: `${fmtDateTime(d.from)} → ${fmtDateTime(d.to)}` };
    }
    case "APPOINTMENT_CANCELLED": {
      const d = data as ActivityData["APPOINTMENT_CANCELLED"];
      return { title: "Appuntamento annullato", detail: d.reason };
    }
    case "APPOINTMENT_COMPLETED":
      return { title: "Appuntamento svolto" };
    case "APPOINTMENT_NO_SHOW":
      return { title: "Non presentato all'appuntamento" };
    case "OPPORTUNITY_CREATED": {
      const d = data as ActivityData["OPPORTUNITY_CREATED"];
      return { title: `Opportunità creata — ${d.name}`, detail: `${d.pipelineName} · ${d.stageName} · ${formatCurrency(d.value)}` };
    }
    case "OPPORTUNITY_STAGE_CHANGED": {
      const d = data as ActivityData["OPPORTUNITY_STAGE_CHANGED"];
      return { title: `Cambio fase: ${d.fromStage ?? "—"} → ${d.toStage}`, detail: d.name };
    }
    case "OPPORTUNITY_WON": {
      const d = data as ActivityData["OPPORTUNITY_WON"];
      return { title: `Opportunità vinta — ${d.name}`, detail: formatCurrency(d.value) };
    }
    case "OPPORTUNITY_LOST": {
      const d = data as ActivityData["OPPORTUNITY_LOST"];
      return { title: `Opportunità persa — ${d.name}`, detail: d.reason };
    }
    case "CLIENT_LINKED":
      return { title: "Collegato al cliente di fatturazione" };
    default:
      return { title: type };
  }
}
