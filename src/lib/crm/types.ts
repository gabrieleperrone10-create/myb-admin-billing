import type { ActivityType, CustomFieldType } from "@prisma/client";

/**
 * Contratti condivisi del CRM. Le colonne Json dello schema (Activity.data,
 * Form.fields, Form.settings, Contact.attribution, Calendar.settings,
 * SavedView.filters) hanno la loro forma definita QUI: chi scrive e chi legge
 * importano questi tipi, cosi' un cambio di forma rompe la compilazione
 * invece di finire in un JSON illeggibile.
 */

// ─── Attribuzione ──────────────────────────────────────────────────────────

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  referrer?: string;
  landingUrl?: string;
  /** ISO */
  at?: string;
};

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;

// ─── Activity.data per tipo ────────────────────────────────────────────────

export type ActivityData = {
  CONTACT_CREATED: { source?: string };
  CONTACT_UPDATED: { fields: string[] };
  LIFECYCLE_CHANGED: { from: string; to: string };
  TAG_ADDED: { tagId: string; name: string };
  TAG_REMOVED: { tagId: string; name: string };
  NOTE_ADDED: { noteId: string; preview: string };
  PAGE_VIEW: { pageViewId: string; url: string; title?: string };
  FORM_SUBMITTED: { formId: string; formName: string; submissionId: string };
  EMAIL_SENT: { messageId: string; subject?: string };
  EMAIL_RECEIVED: { messageId: string; subject?: string };
  EMAIL_OPENED: { messageId: string; subject?: string };
  EMAIL_CLICKED: { messageId: string; subject?: string; url?: string };
  EMAIL_BOUNCED: { messageId: string; reason?: string };
  WHATSAPP_SENT: { messageId: string; preview?: string; template?: string };
  WHATSAPP_RECEIVED: { messageId: string; preview?: string };
  APPOINTMENT_BOOKED: { appointmentId: string; calendarName: string; startTime: string };
  APPOINTMENT_RESCHEDULED: { appointmentId: string; from: string; to: string };
  APPOINTMENT_CANCELLED: { appointmentId: string; reason?: string };
  APPOINTMENT_COMPLETED: { appointmentId: string };
  APPOINTMENT_NO_SHOW: { appointmentId: string };
  OPPORTUNITY_CREATED: { opportunityId: string; name: string; pipelineName: string; stageName: string; value: number };
  OPPORTUNITY_STAGE_CHANGED: { opportunityId: string; name: string; fromStage?: string; toStage: string };
  OPPORTUNITY_WON: { opportunityId: string; name: string; value: number };
  OPPORTUNITY_LOST: { opportunityId: string; name: string; reason?: string };
  CLIENT_LINKED: { clientId: string; backfill?: boolean };
  TASK_CREATED: { taskId: string; title: string; dueAt?: string; assigneeUserId?: string };
  TASK_COMPLETED: { taskId: string; title: string };
};

// Garantisce che ogni valore dell'enum Prisma abbia una forma qui sopra.
type _MissingActivityData = Exclude<ActivityType, keyof ActivityData>;
const _check: [_MissingActivityData] extends [never] ? true : never = true;
void _check;

/** Etichette italiane per la cronologia. */
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  CONTACT_CREATED: "Contatto creato",
  CONTACT_UPDATED: "Contatto aggiornato",
  LIFECYCLE_CHANGED: "Stato cambiato",
  TAG_ADDED: "Etichetta aggiunta",
  TAG_REMOVED: "Etichetta rimossa",
  NOTE_ADDED: "Nota",
  PAGE_VIEW: "Pagina visitata",
  FORM_SUBMITTED: "Form compilato",
  EMAIL_SENT: "Email inviata",
  EMAIL_RECEIVED: "Email ricevuta",
  EMAIL_OPENED: "Email aperta",
  EMAIL_CLICKED: "Link cliccato",
  EMAIL_BOUNCED: "Email non recapitata",
  WHATSAPP_SENT: "WhatsApp inviato",
  WHATSAPP_RECEIVED: "WhatsApp ricevuto",
  APPOINTMENT_BOOKED: "Appuntamento prenotato",
  APPOINTMENT_RESCHEDULED: "Appuntamento spostato",
  APPOINTMENT_CANCELLED: "Appuntamento annullato",
  APPOINTMENT_COMPLETED: "Appuntamento svolto",
  APPOINTMENT_NO_SHOW: "Non presentato",
  OPPORTUNITY_CREATED: "Opportunità creata",
  OPPORTUNITY_STAGE_CHANGED: "Cambio fase",
  OPPORTUNITY_WON: "Opportunità vinta",
  OPPORTUNITY_LOST: "Opportunità persa",
  CLIENT_LINKED: "Collegato a cliente di fatturazione",
  TASK_CREATED: "Task creato",
  TASK_COMPLETED: "Task completato",
};

// ─── Campi (custom field e form) ───────────────────────────────────────────

/** Campi standard di Contact mappabili da form/import. */
export const CONTACT_STANDARD_FIELDS = [
  { key: "firstName", label: "Nome", type: "TEXT" },
  { key: "lastName", label: "Cognome", type: "TEXT" },
  { key: "email", label: "Email", type: "EMAIL" },
  { key: "phone", label: "Telefono", type: "PHONE" },
  { key: "whatsapp", label: "WhatsApp", type: "PHONE" },
  { key: "companyName", label: "Azienda", type: "TEXT" },
  { key: "jobTitle", label: "Ruolo", type: "TEXT" },
] as const satisfies readonly { key: string; label: string; type: CustomFieldType }[];

export type ContactStandardKey = (typeof CONTACT_STANDARD_FIELDS)[number]["key"];

/** Un campo di un form: mappato su un campo standard (`std:email`) o custom (`cf:<key>`), oppure libero (solo nella submission). */
export type FormField = {
  id: string;
  label: string;
  type: CustomFieldType;
  /** "std:<ContactStandardKey>" | "cf:<CustomFieldDef.key>" | null */
  mapTo: string | null;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** SELECT/MULTISELECT */
  options?: string[];
};

export type FormSettings = {
  submitLabel?: string;
  successMessage?: string;
  redirectUrl?: string;
  /** CrmTag.id da applicare al contatto */
  tagIds?: string[];
  /** Se valorizzati, ogni invio crea un'opportunita' */
  pipelineId?: string;
  stageId?: string;
  ownerUserId?: string;
  /** Colori/aspetto per la pagina ospitata e l'embed */
  theme?: { primaryColor?: string; background?: string };
};

export type CalendarSettings = {
  questions?: FormField[];
  pipelineId?: string;
  stageId?: string;
  tagIds?: string[];
};

// ─── Filtri lista contatti (SavedView.filters) ─────────────────────────────

export type ContactFilters = {
  q?: string;
  lifecycle?: ("LEAD" | "CUSTOMER" | "ARCHIVED")[];
  tagIds?: string[];
  ownerUserIds?: string[];
  source?: string[];
  createdFrom?: string;
  createdTo?: string;
  /** Filtri sui custom field: key -> valore (uguaglianza; per MULTISELECT "contiene") */
  custom?: Record<string, string | number | boolean>;
};
