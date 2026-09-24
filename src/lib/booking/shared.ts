import { formatInTimeZone } from "date-fns-tz";
import { it } from "date-fns/locale";
import type { AppointmentLocation, AppointmentStatus } from "@prisma/client";
import type { CalendarSettings, FormField } from "@/lib/crm/types";

/**
 * Costanti ed helper del booking utilizzabili ovunque (server, client, script):
 * niente DB, niente "server-only".
 */

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Prenotato",
  CONFIRMED: "Confermato",
  COMPLETED: "Svolto",
  CANCELLED: "Annullato",
  NO_SHOW: "Non presentato",
};

export const APPOINTMENT_STATUS_VARIANT: Record<AppointmentStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  SCHEDULED: "info",
  CONFIRMED: "ok",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "warn",
};

export const ACTIVE_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED"];

export const LOCATION_LABEL: Record<AppointmentLocation, string> = {
  VIDEO: "Videochiamata",
  PHONE: "Telefono",
  IN_PERSON: "Di persona",
  CUSTOM: "Altro",
};

export const DAY_LABELS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
/** Ordine di visualizzazione: lunedi' prima. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const COMMON_TIMEZONES = [
  "Europe/Rome", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Zurich",
  "Europe/Lisbon", "Europe/Athens", "Europe/Bucharest", "Europe/Moscow", "Africa/Cairo", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires", "America/Mexico_City", "UTC",
];

export function parseCalendarSettings(raw: unknown): CalendarSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    questions: Array.isArray(o.questions) ? (o.questions as FormField[]) : [],
    pipelineId: typeof o.pipelineId === "string" && o.pipelineId ? o.pipelineId : undefined,
    stageId: typeof o.stageId === "string" && o.stageId ? o.stageId : undefined,
    tagIds: Array.isArray(o.tagIds) ? (o.tagIds as unknown[]).map(String) : [],
  };
}

export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const CALENDAR_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

/** "giovedì 1 ottobre 2026, 10:30" nel fuso indicato. */
export function formatDateTimeLong(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "EEEE d MMMM yyyy, HH:mm", { locale: it });
}

/** "gio 1 ott, 10:30" */
export function formatDateTimeShort(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "EEE d MMM, HH:mm", { locale: it });
}

export function formatTime(d: Date | string, tz: string): string {
  return formatInTimeZone(new Date(d), tz, "HH:mm");
}

export function locationText(type: AppointmentLocation, value: string | null, videoLink?: string | null): string {
  if (type === "VIDEO") return videoLink ? `Videochiamata: ${videoLink}` : "Videochiamata (il link arriverà via email)";
  if (type === "PHONE") return value ? `Telefono: ${value}` : "Telefonata";
  if (type === "IN_PERSON") return value ? `Indirizzo: ${value}` : "Di persona";
  return value || "Da definire";
}

export function publicBookingPath(companySlug: string, calendarSlug: string) {
  return `/book/${companySlug}/${calendarSlug}`;
}

export function manageBookingPath(token: string) {
  return `/book/manage/${token}`;
}
