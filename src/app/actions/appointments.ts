"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import {
  availableSlots, bookAppointment, cancelAppointment, rescheduleAppointment, setAppointmentStatus,
} from "@/lib/booking/engine";
import { appBaseUrl } from "@/lib/booking/emails";
import { addDaysStr, groupSlotsByDay, isValidDateStr, isValidTimeZone, zonedRange } from "@/lib/booking/slots";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return appBaseUrl(host ? `${proto}://${host}` : null);
}

function revalidate(ctx: CompanyContext, contactId?: string) {
  revalidatePath(`/${ctx.slug}/calendars/appointments`);
  if (contactId) revalidatePath(`/${ctx.slug}/contacts/${contactId}`);
}

export const updateAppointmentStatus = companyAction(
  async (ctx, id: string, status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW"): Promise<Result> => {
    if (!["SCHEDULED", "CONFIRMED", "COMPLETED", "NO_SHOW"].includes(status)) return { ok: false, error: "Stato non valido" };
    const r = await setAppointmentStatus(ctx.db, ctx.companyId, id, status, ctx.userId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidate(ctx, r.value.contactId);
    return { ok: true };
  },
);

export const cancelAppointmentAdmin = companyAction(
  async (ctx, id: string, reason: string, notifyContact: boolean): Promise<Result> => {
    const appt = await ctx.db.appointment.findUnique({
      where: { id },
      include: { calendar: { include: { availability: true } } },
    });
    if (!appt) return { ok: false, error: "Appuntamento non trovato" };
    const r = await cancelAppointment(ctx.db, ctx.company, appt, {
      reason, actorUserId: ctx.userId, baseUrl: await baseUrl(), byGuest: false, notifyContact,
    });
    if (!r.ok) return { ok: false, error: r.error };
    revalidate(ctx, appt.contactId);
    return { ok: true };
  },
);

export const rescheduleAppointmentAdmin = companyAction(
  async (ctx, id: string, startTimeIso: string): Promise<Result> => {
    const appt = await ctx.db.appointment.findUnique({
      where: { id },
      include: { calendar: { include: { availability: true } } },
    });
    if (!appt) return { ok: false, error: "Appuntamento non trovato" };
    const r = await rescheduleAppointment(ctx.db, ctx.company, appt, new Date(startTimeIso), {
      actorUserId: ctx.userId, baseUrl: await baseUrl(), byGuest: false,
    });
    if (!r.ok) return { ok: false, error: r.error };
    revalidate(ctx, appt.contactId);
    return { ok: true };
  },
);

/** Slot liberi per l'admin (stesso calcolo della pagina pubblica, anche su calendari disattivi). */
export const getAdminSlots = companyAction(
  async (ctx, calendarId: string, from: string, to: string, tz: string, excludeAppointmentId?: string | null): Promise<Result<{ days: Record<string, string[]>; timezone: string }>> => {
    if (!isValidDateStr(from) || !isValidDateStr(to) || to < from || addDaysStr(from, 62) < to) {
      return { ok: false, error: "Intervallo non valido" };
    }
    const cal = await ctx.db.calendar.findUnique({ where: { id: calendarId }, include: { availability: true } });
    if (!cal) return { ok: false, error: "Calendario non trovato" };
    const zone = isValidTimeZone(tz) ? tz : cal.timezone;
    const exclude = excludeAppointmentId
      ? await ctx.db.appointment.findUnique({ where: { id: excludeAppointmentId }, select: { id: true, startTime: true, endTime: true } })
      : null;
    const { start, end } = zonedRange(from, to, zone);
    const slots = await availableSlots(ctx.db, ctx.companyId, cal, start, end, { exclude });
    return { ok: true, data: { days: groupSlotsByDay(slots, zone), timezone: zone } };
  },
);

/** "Prenota per questo contatto": stessa logica della pagina pubblica. */
export const bookForContact = companyAction(
  async (ctx, input: { calendarId: string; contactId: string; startTime: string; notes?: string; notifyContact: boolean }): Promise<Result> => {
    const cal = await ctx.db.calendar.findUnique({ where: { id: input.calendarId }, include: { availability: true } });
    if (!cal) return { ok: false, error: "Calendario non trovato" };
    const r = await bookAppointment(ctx.db, ctx.company, cal, {
      origin: "internal",
      startTime: new Date(input.startTime),
      contactId: input.contactId,
      notes: input.notes,
      actorUserId: ctx.userId,
      baseUrl: await baseUrl(),
      notifyContact: input.notifyContact,
    });
    if (!r.ok) return { ok: false, error: r.error };
    revalidate(ctx, input.contactId);
    return { ok: true };
  },
);
