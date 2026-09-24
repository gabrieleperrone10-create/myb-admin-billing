import "server-only";
import { Prisma, type Appointment, type AppointmentStatus, type Availability, type Calendar, type Company, type Contact } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { upsertContact, contactDisplayName, normalizeEmail } from "@/lib/crm/contacts";
import { logActivity } from "@/lib/crm/activity";
import { createOpportunity } from "@/lib/crm/opportunities";
import { coerceFieldValue, type CustomFieldValue, type CustomFieldValues } from "@/lib/crm/customFields";
import { CONTACT_STANDARD_FIELDS, type Attribution } from "@/lib/crm/types";
import { computeSlots, isSlotAvailable, type BusyInterval, type SlotRules } from "./slots";
import { ACTIVE_STATUSES, parseCalendarSettings } from "./shared";
import { createGoogleEvent, deleteGoogleEvent, getGoogleBusy, updateGoogleEvent } from "./google";
import { notifyGuest, notifyHost } from "./notify";

/**
 * Motore delle prenotazioni: calcolo disponibilita' reale (DB + Google),
 * creazione, spostamento, annullamento, cambi di stato.
 *
 * Portato da Nutrizionisti-app `src/lib/services/bookAppointment.ts` e
 * `bookingSlots.ts`. Un solo punto per pagina pubblica, link di gestione e
 * "Prenota per questo contatto" dall'admin: stessi controlli ovunque.
 *
 * `db` e' SEMPRE un client filtrato per azienda (companyDb / ctx.db).
 */

export type BookingCalendar = Calendar & { availability: Availability[] };

export type BookingResult<T> = { ok: true; value: T } | { ok: false; status: 400 | 404 | 409; error: string };

export const SLOT_TAKEN_ERROR = "Orario non più disponibile";

export function rulesOf(cal: BookingCalendar): SlotRules {
  return {
    timezone: cal.timezone,
    availability: cal.availability.map(a => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })),
    durationMinutes: cal.durationMinutes,
    slotIntervalMinutes: cal.slotIntervalMinutes,
    bufferMinutes: cal.bufferMinutes,
    minAdvanceHours: cal.minAdvanceHours,
    maxAdvanceDays: cal.maxAdvanceDays,
  };
}

/**
 * Intervalli occupati dell'host: appuntamenti attivi su QUALUNQUE calendario
 * dell'azienda di cui e' host + impegni Google. Solo start/end: nessun altro
 * dato esce da qui.
 */
export async function hostBusy(
  db: CompanyDb,
  companyId: string,
  hostUserId: string,
  start: Date,
  end: Date,
  opts: { exclude?: Pick<Appointment, "id" | "startTime" | "endTime"> | null } = {},
): Promise<BusyInterval[]> {
  const pad = 24 * 3600_000;
  const from = new Date(start.getTime() - pad);
  const to = new Date(end.getTime() + pad);
  const [appts, google] = await Promise.all([
    db.appointment.findMany({
      where: {
        hostUserId,
        status: { in: ACTIVE_STATUSES },
        startTime: { lt: to },
        endTime: { gt: from },
        ...(opts.exclude ? { id: { not: opts.exclude.id } } : {}),
      },
      select: { startTime: true, endTime: true },
    }),
    getGoogleBusy(companyId, hostUserId, from, to),
  ]);
  const ex = opts.exclude;
  // L'evento Google dell'appuntamento che si sposta risulterebbe ancora
  // occupato: si toglie l'intervallo identico (best effort, freebusy puo'
  // averlo fuso con uno adiacente).
  const googleFiltered = ex
    ? google.filter(g => !(g.start.getTime() === ex.startTime.getTime() && g.end.getTime() === ex.endTime.getTime()))
    : google;
  return [...appts.map(a => ({ start: a.startTime, end: a.endTime })), ...googleFiltered];
}

export async function availableSlots(
  db: CompanyDb,
  companyId: string,
  cal: BookingCalendar,
  start: Date,
  end: Date,
  opts: { exclude?: Pick<Appointment, "id" | "startTime" | "endTime"> | null; now?: Date } = {},
): Promise<Date[]> {
  if (!cal.availability.length) return [];
  const busy = await hostBusy(db, companyId, cal.hostUserId, start, end, opts);
  return computeSlots(rulesOf(cal), busy, start, end, opts.now);
}

async function slotIsFree(
  db: CompanyDb,
  companyId: string,
  cal: BookingCalendar,
  start: Date,
  exclude?: Pick<Appointment, "id" | "startTime" | "endTime"> | null,
): Promise<boolean> {
  const end = new Date(start.getTime() + cal.durationMinutes * 60_000);
  const busy = await hostBusy(db, companyId, cal.hostUserId, start, end, { exclude });
  return isSlotAvailable(rulesOf(cal), busy, start);
}

/**
 * Violazione del vincolo `Appointment_no_overlap` (EXCLUDE gist, SQLSTATE
 * 23P01): in Prisma 5 arriva come PrismaClientUnknownRequestError o come
 * KnownRequestError (P2010/P2034...) con il codice Postgres nel messaggio o
 * nei meta. Si guarda ovunque.
 */
export function isOverlapError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const parts: string[] = [];
  if (e instanceof Error) parts.push(e.message);
  const meta = (e as { meta?: unknown }).meta;
  if (meta) {
    try { parts.push(JSON.stringify(meta)); } catch { /* ignorato */ }
  }
  const code = (e as { code?: unknown }).code;
  if (typeof code === "string") parts.push(code);
  const s = parts.join(" ");
  return /23P01|exclusion constraint|Appointment_no_overlap/i.test(s);
}

// ─── Domande extra ────────────────────────────────────────────────────────

const STD_KEYS = new Set<string>(CONTACT_STANDARD_FIELDS.map(f => f.key));

type ParsedAnswers = {
  /** etichetta -> valore, per Appointment.answers */
  answers: Record<string, CustomFieldValue>;
  std: Partial<Record<string, string>>;
  custom: CustomFieldValues;
};

async function parseQuestions(
  db: CompanyDb,
  cal: Calendar,
  raw: Record<string, unknown>,
  enforceRequired: boolean,
): Promise<{ ok: true; value: ParsedAnswers } | { ok: false; error: string }> {
  const { questions = [] } = parseCalendarSettings(cal.settings);
  const out: ParsedAnswers = { answers: {}, std: {}, custom: {} };
  const cfKeys = questions.map(q => q.mapTo).filter((m): m is string => !!m?.startsWith("cf:")).map(m => m.slice(3));
  const defs = cfKeys.length
    ? await db.customFieldDef.findMany({ where: { entity: "CONTACT", key: { in: cfKeys } } })
    : [];
  for (const q of questions) {
    const r = coerceFieldValue(
      { type: q.type, options: q.options ?? null, required: enforceRequired && q.required, label: q.label },
      raw[q.id],
    );
    if (!r.ok) return { ok: false, error: r.error };
    if (r.value === null) continue;
    out.answers[q.label] = r.value;
    if (q.mapTo?.startsWith("std:")) {
      const k = q.mapTo.slice(4);
      if (STD_KEYS.has(k) && typeof r.value === "string") out.std[k] = r.value;
    } else if (q.mapTo?.startsWith("cf:")) {
      const def = defs.find(d => d.key === q.mapTo!.slice(3));
      if (def) {
        const c = coerceFieldValue({ ...def, required: false }, r.value);
        if (c.ok) out.custom[def.key] = c.value;
      }
    }
  }
  return { ok: true, value: out };
}

// ─── Prenotazione ─────────────────────────────────────────────────────────

export type BookInput = {
  origin: "public" | "internal";
  startTime: Date;
  /** Admin: contatto gia' esistente. */
  contactId?: string;
  /** Pagina pubblica: dati inseriti. */
  guest?: { firstName: string; lastName?: string | null; email: string; phone?: string | null };
  /** Risposte alle domande extra, per FormField.id */
  answers?: Record<string, unknown>;
  notes?: string | null;
  visitorId?: string | null;
  attribution?: Attribution | null;
  actorUserId?: string | null;
  baseUrl: string;
  /** Default true */
  notifyContact?: boolean;
};

export async function bookAppointment(
  db: CompanyDb,
  company: Company,
  cal: BookingCalendar,
  input: BookInput,
): Promise<BookingResult<Appointment>> {
  const companyId = company.id;
  const start = input.startTime;
  if (Number.isNaN(start.getTime())) return { ok: false, status: 400, error: "Data/ora non valida" };
  if (!cal.active && input.origin === "public") return { ok: false, status: 404, error: "Calendario non disponibile" };

  const parsed = await parseQuestions(db, cal, input.answers ?? {}, input.origin === "public");
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  if (!(await slotIsFree(db, companyId, cal, start))) return { ok: false, status: 409, error: SLOT_TAKEN_ERROR };

  // Contatto
  let contact: Contact | null;
  if (input.contactId) {
    contact = await db.contact.findUnique({ where: { id: input.contactId } });
    if (!contact) return { ok: false, status: 404, error: "Contatto non trovato" };
  } else if (input.guest) {
    const email = normalizeEmail(input.guest.email);
    if (!email) return { ok: false, status: 400, error: "Email non valida" };
    try {
      const std = parsed.value.std;
      ({ contact } = await upsertContact(db, companyId, {
        email,
        phone: input.guest.phone || std.phone || null,
        whatsapp: std.whatsapp ?? null,
        firstName: input.guest.firstName,
        lastName: input.guest.lastName ?? null,
        companyName: std.companyName ?? null,
        jobTitle: std.jobTitle ?? null,
        source: "booking",
        ownerUserId: cal.hostUserId,
        attribution: input.attribution ?? null,
        customFields: parsed.value.custom,
      }, { actorUserId: input.actorUserId }));
    } catch (e) {
      return { ok: false, status: 400, error: e instanceof Error ? e.message : "Contatto non valido" };
    }
  } else {
    return { ok: false, status: 400, error: "Contatto mancante" };
  }

  const guestName = input.guest
    ? [input.guest.firstName, input.guest.lastName].filter(Boolean).join(" ").trim()
    : contactDisplayName(contact);
  const end = new Date(start.getTime() + cal.durationMinutes * 60_000);

  const answers: Record<string, unknown> = { ...parsed.value.answers };
  if (input.visitorId) answers._visitorId = input.visitorId;

  let appt: Appointment;
  try {
    appt = await db.appointment.create({
      data: {
        companyId,
        calendarId: cal.id,
        contactId: contact.id,
        hostUserId: cal.hostUserId,
        title: `${cal.name} — ${guestName}`,
        startTime: start,
        endTime: end,
        status: "SCHEDULED",
        guestName,
        guestEmail: input.guest ? normalizeEmail(input.guest.email) : contact.email,
        guestPhone: input.guest?.phone || contact.phone || null,
        notes: input.notes?.trim() || null,
        answers: Object.keys(answers).length ? (answers as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, status: 409, error: SLOT_TAKEN_ERROR };
    throw e;
  }

  // Da qui in poi l'appuntamento esiste: nessun errore secondario deve farlo fallire.
  const settings = parseCalendarSettings(cal.settings);
  await applyTags(db, companyId, contact.id, settings.tagIds ?? [], input.actorUserId).catch(e => console.error("[booking] etichette:", e));

  if (settings.pipelineId) {
    try {
      // Chi riprenota con un'opportunita' ancora aperta nella stessa pipeline
      // non ne genera una seconda: l'appuntamento si aggancia a quella.
      const open = await db.opportunity.findFirst({
        where: { contactId: contact.id, pipelineId: settings.pipelineId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const opp = open ?? await createOpportunity(db, companyId, {
        contactId: contact.id,
        pipelineId: settings.pipelineId,
        stageId: settings.stageId ?? null,
        ownerUserId: cal.hostUserId,
        source: "booking",
        name: `${guestName} — ${cal.name}`,
      }, { actorUserId: input.actorUserId });
      appt = await db.appointment.update({ where: { id: appt.id }, data: { opportunityId: opp.id } });
    } catch (e) {
      console.error("[booking] opportunita':", e);
    }
  }

  appt = await attachGoogleEvent(db, companyId, cal, appt);

  await logActivity(db, companyId, {
    contactId: contact.id,
    opportunityId: appt.opportunityId,
    type: "APPOINTMENT_BOOKED",
    data: { appointmentId: appt.id, calendarName: cal.name, startTime: appt.startTime.toISOString() },
    actorUserId: input.actorUserId,
  }).catch(e => console.error("[booking] attivita':", e));

  if (input.notifyContact !== false && appt.guestEmail) {
    await notifyGuest(db, { company, appointment: appt, calendar: cal, kind: "CONFIRMATION", baseUrl: input.baseUrl });
  }
  if (input.actorUserId !== cal.hostUserId) {
    await notifyHost("BOOKED", { company, appointment: appt, calendar: cal, baseUrl: input.baseUrl });
  }

  return { ok: true, value: appt };
}

async function applyTags(db: CompanyDb, companyId: string, contactId: string, tagIds: string[], actorUserId?: string | null) {
  if (!tagIds.length) return;
  const tags = await db.crmTag.findMany({ where: { id: { in: tagIds } } });
  for (const tag of tags) {
    const exists = await db.contactTag.findFirst({ where: { contactId, tagId: tag.id } });
    if (exists) continue;
    try {
      await db.contactTag.create({ data: { companyId, contactId, tagId: tag.id } });
      await logActivity(db, companyId, { contactId, type: "TAG_ADDED", data: { tagId: tag.id, name: tag.name }, actorUserId });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
}

function googleLocation(cal: Calendar): string | null {
  if (cal.locationType === "IN_PERSON") return cal.locationValue;
  if (cal.locationType === "PHONE") return cal.locationValue ? `Telefono: ${cal.locationValue}` : "Telefono";
  if (cal.locationType === "CUSTOM") return cal.locationValue;
  return null;
}

/** Crea l'evento Google (con Meet se "video"). Mai lancia. */
async function attachGoogleEvent(db: CompanyDb, companyId: string, cal: Calendar, appt: Appointment): Promise<Appointment> {
  try {
    const ev = await createGoogleEvent({
      companyId,
      hostUserId: appt.hostUserId,
      summary: appt.title,
      description: [appt.guestEmail, appt.guestPhone, appt.notes].filter(Boolean).join("\n") || undefined,
      location: googleLocation(cal),
      start: appt.startTime,
      end: appt.endTime,
      timeZone: cal.timezone,
      attendee: appt.guestEmail ? { email: appt.guestEmail, name: appt.guestName ?? undefined } : null,
      createMeetLink: cal.locationType === "VIDEO",
    });
    // Video senza Google: se il calendario ha un link fisso (Zoom, Meet
    // permanente...) lo si usa come link della videochiamata.
    const fixedLink = cal.locationType === "VIDEO" && cal.locationValue && /^https?:\/\//i.test(cal.locationValue) ? cal.locationValue : null;
    const videoLink = ev?.meetLink ?? fixedLink;
    if (!ev && !videoLink) return appt;
    return await db.appointment.update({
      where: { id: appt.id },
      data: { googleEventId: ev?.eventId ?? null, videoLink },
    });
  } catch (e) {
    console.error("[booking] evento Google:", e);
    return appt;
  }
}

// ─── Spostamento / annullamento / stato ───────────────────────────────────

type ApptWithCal = Appointment & { calendar: BookingCalendar };

export async function rescheduleAppointment(
  db: CompanyDb,
  company: Company,
  appt: ApptWithCal,
  newStart: Date,
  opts: { actorUserId?: string | null; baseUrl: string; byGuest: boolean },
): Promise<BookingResult<Appointment>> {
  if (!ACTIVE_STATUSES.includes(appt.status)) return { ok: false, status: 400, error: "L'appuntamento non è più modificabile" };
  if (Number.isNaN(newStart.getTime())) return { ok: false, status: 400, error: "Data/ora non valida" };
  const cal = appt.calendar;
  if (!(await slotIsFree(db, company.id, cal, newStart, appt))) return { ok: false, status: 409, error: SLOT_TAKEN_ERROR };

  const from = appt.startTime;
  const newEnd = new Date(newStart.getTime() + cal.durationMinutes * 60_000);
  let updated: Appointment;
  try {
    updated = await db.appointment.update({
      where: { id: appt.id },
      data: { startTime: newStart, endTime: newEnd, rescheduledCount: { increment: 1 }, status: "SCHEDULED" },
    });
  } catch (e) {
    if (isOverlapError(e)) return { ok: false, status: 409, error: SLOT_TAKEN_ERROR };
    throw e;
  }

  // I promemoria del vecchio orario non valgono per il nuovo.
  await db.notificationLog.deleteMany({ where: { appointmentId: appt.id, kind: "REMINDER" } }).catch(() => undefined);

  if (updated.googleEventId) {
    await updateGoogleEvent({
      companyId: company.id, hostUserId: updated.hostUserId, eventId: updated.googleEventId,
      start: newStart, end: newEnd, timeZone: cal.timezone,
    });
  } else {
    updated = await attachGoogleEvent(db, company.id, cal, updated);
  }

  await logActivity(db, company.id, {
    contactId: updated.contactId,
    opportunityId: updated.opportunityId,
    type: "APPOINTMENT_RESCHEDULED",
    data: { appointmentId: updated.id, from: from.toISOString(), to: newStart.toISOString() },
    actorUserId: opts.actorUserId,
  }).catch(e => console.error("[booking] attivita':", e));

  if (updated.guestEmail) {
    await notifyGuest(db, {
      company, appointment: updated, calendar: cal, kind: "RESCHEDULE",
      offsetMinutes: updated.rescheduledCount, baseUrl: opts.baseUrl,
    });
  }
  if (opts.byGuest) await notifyHost("RESCHEDULED", { company, appointment: updated, calendar: cal, baseUrl: opts.baseUrl });
  return { ok: true, value: updated };
}

export async function cancelAppointment(
  db: CompanyDb,
  company: Company,
  appt: ApptWithCal,
  opts: { reason?: string | null; actorUserId?: string | null; baseUrl: string; byGuest: boolean; notifyContact?: boolean },
): Promise<BookingResult<Appointment>> {
  if (!ACTIVE_STATUSES.includes(appt.status)) return { ok: false, status: 400, error: "L'appuntamento non è più attivo" };
  const reason = opts.reason?.trim().slice(0, 500) || null;
  const updated = await db.appointment.update({
    where: { id: appt.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  if (updated.googleEventId) {
    await deleteGoogleEvent({ companyId: company.id, hostUserId: updated.hostUserId, eventId: updated.googleEventId });
  }
  await logActivity(db, company.id, {
    contactId: updated.contactId,
    opportunityId: updated.opportunityId,
    type: "APPOINTMENT_CANCELLED",
    data: { appointmentId: updated.id, reason: reason ?? undefined },
    actorUserId: opts.actorUserId,
  }).catch(e => console.error("[booking] attivita':", e));

  if (opts.notifyContact !== false && updated.guestEmail) {
    await notifyGuest(db, { company, appointment: updated, calendar: appt.calendar, kind: "CANCELLATION", baseUrl: opts.baseUrl });
  }
  if (opts.byGuest) await notifyHost("CANCELLED", { company, appointment: updated, calendar: appt.calendar, baseUrl: opts.baseUrl });
  return { ok: true, value: updated };
}

/** Conferma / svolto / non presentato / di nuovo prenotato (dall'admin). */
export async function setAppointmentStatus(
  db: CompanyDb,
  companyId: string,
  appointmentId: string,
  status: Exclude<AppointmentStatus, "CANCELLED">,
  actorUserId: string,
): Promise<BookingResult<Appointment>> {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return { ok: false, status: 404, error: "Appuntamento non trovato" };
  if (appt.status === status) return { ok: true, value: appt };
  if (appt.status === "CANCELLED") return { ok: false, status: 400, error: "Appuntamento annullato: prenotane uno nuovo" };
  let updated: Appointment;
  try {
    updated = await db.appointment.update({ where: { id: appointmentId }, data: { status } });
  } catch (e) {
    // riattivare un appuntamento (es. NO_SHOW -> SCHEDULED) puo' urtare il vincolo
    if (isOverlapError(e)) return { ok: false, status: 409, error: "Orario ormai occupato da un altro appuntamento" };
    throw e;
  }
  if (status === "COMPLETED" || status === "NO_SHOW") {
    await logActivity(db, companyId, {
      contactId: updated.contactId,
      opportunityId: updated.opportunityId,
      type: status === "COMPLETED" ? "APPOINTMENT_COMPLETED" : "APPOINTMENT_NO_SHOW",
      data: { appointmentId: updated.id },
      actorUserId,
    });
  }
  return { ok: true, value: updated };
}
