import type { ActivityType } from "@prisma/client";

/** Chip di filtro della cronologia: chiave nell'URL (?type=) -> tipi Activity inclusi. */
export const ACTIVITY_FILTERS: { key: string; label: string; types?: ActivityType[] }[] = [
  { key: "ALL", label: "Tutto" },
  { key: "NOTE", label: "Note", types: ["NOTE_ADDED"] },
  { key: "EMAIL", label: "Email", types: ["EMAIL_SENT", "EMAIL_RECEIVED", "EMAIL_OPENED", "EMAIL_CLICKED", "EMAIL_BOUNCED"] },
  { key: "WHATSAPP", label: "WhatsApp", types: ["WHATSAPP_SENT", "WHATSAPP_RECEIVED"] },
  { key: "PAGE_VIEW", label: "Pagine visitate", types: ["PAGE_VIEW"] },
  { key: "FORM", label: "Form", types: ["FORM_SUBMITTED"] },
  { key: "APPOINTMENT", label: "Appuntamenti", types: ["APPOINTMENT_BOOKED", "APPOINTMENT_RESCHEDULED", "APPOINTMENT_CANCELLED", "APPOINTMENT_COMPLETED", "APPOINTMENT_NO_SHOW"] },
  { key: "OPPORTUNITY", label: "Opportunità", types: ["OPPORTUNITY_CREATED", "OPPORTUNITY_STAGE_CHANGED", "OPPORTUNITY_WON", "OPPORTUNITY_LOST"] },
  { key: "TASK", label: "Task", types: ["TASK_CREATED", "TASK_COMPLETED"] },
  { key: "SYSTEM", label: "Sistema", types: ["CONTACT_CREATED", "CONTACT_UPDATED", "LIFECYCLE_CHANGED", "TAG_ADDED", "TAG_REMOVED", "CLIENT_LINKED"] },
];

export function activityTypesForFilter(key: string): ActivityType[] | undefined {
  return ACTIVITY_FILTERS.find(f => f.key === key)?.types;
}
