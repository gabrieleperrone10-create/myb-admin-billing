"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { companyAction } from "@/lib/companyAction";
import { basePrisma } from "@/lib/db";
import { disconnectGoogle } from "@/lib/booking/google";
import { CALENDAR_SLUG_RE } from "@/lib/booking/shared";
import { isValidTime, isValidTimeZone } from "@/lib/booking/slots";
import type { CalendarSettings, FormField } from "@/lib/crm/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const FIELD_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "MULTISELECT", "CHECKBOX", "URL", "EMAIL", "PHONE"] as const;

const questionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Ogni domanda deve avere un testo").max(200),
  type: z.enum(FIELD_TYPES),
  mapTo: z.string().max(80).nullable(),
  required: z.boolean(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

const calendarSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(120),
  slug: z.string().trim().regex(CALENDAR_SLUG_RE, "Slug non valido: solo lettere minuscole, numeri e trattini"),
  description: z.string().trim().max(2000).optional().nullable(),
  hostUserId: z.string().min(1, "Scegli chi riceve gli appuntamenti"),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  slotIntervalMinutes: z.number().int().min(5).max(24 * 60),
  bufferMinutes: z.number().int().min(0).max(240),
  minAdvanceHours: z.number().int().min(0).max(24 * 60),
  maxAdvanceDays: z.number().int().min(1).max(730),
  locationType: z.enum(["VIDEO", "PHONE", "IN_PERSON", "CUSTOM"]),
  locationValue: z.string().trim().max(500).optional().nullable(),
  timezone: z.string().refine(isValidTimeZone, "Fuso orario non valido"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido"),
  active: z.boolean(),
  availability: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().refine(isValidTime, "Orario non valido"),
    endTime: z.string().refine(isValidTime, "Orario non valido"),
  })).max(100),
  questions: z.array(questionSchema).max(30),
  pipelineId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
  tagIds: z.array(z.string()).max(50),
});

export type CalendarInput = z.input<typeof calendarSchema>;

function overlapsWithin(ranges: { dayOfWeek: number; startTime: string; endTime: string }[]): string | null {
  for (const r of ranges) if (r.startTime >= r.endTime) return "Ogni fascia deve finire dopo l'inizio";
  for (let d = 0; d < 7; d++) {
    const day = ranges.filter(r => r.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) if (day[i].startTime < day[i - 1].endTime) return "Due fasce dello stesso giorno si sovrappongono";
  }
  return null;
}

export const saveCalendar = companyAction(async (ctx, input: CalendarInput): Promise<Result<{ id: string }>> => {
  const parsed = calendarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const v = parsed.data;

  const overlapErr = overlapsWithin(v.availability);
  if (overlapErr) return { ok: false, error: overlapErr };

  const member = await basePrisma.companyMember.findFirst({ where: { companyId: ctx.companyId, clerkUserId: v.hostUserId } });
  if (!member) return { ok: false, error: "L'host scelto non è membro dell'azienda" };

  let pipelineId: string | undefined;
  let stageId: string | undefined;
  if (v.pipelineId) {
    const p = await ctx.db.pipeline.findUnique({ where: { id: v.pipelineId } });
    if (!p) return { ok: false, error: "Pipeline non trovata" };
    pipelineId = p.id;
    if (v.stageId) {
      const s = await ctx.db.pipelineStage.findFirst({ where: { id: v.stageId, pipelineId: p.id } });
      if (!s) return { ok: false, error: "Fase non trovata nella pipeline" };
      stageId = s.id;
    }
  }
  const tagIds = v.tagIds.length
    ? (await ctx.db.crmTag.findMany({ where: { id: { in: v.tagIds } }, select: { id: true } })).map(t => t.id)
    : [];

  const questions: FormField[] = v.questions.map(q => ({
    ...q,
    options: q.type === "SELECT" || q.type === "MULTISELECT" ? q.options ?? [] : undefined,
  }));
  if (questions.some(q => (q.type === "SELECT" || q.type === "MULTISELECT") && !q.options?.length)) {
    return { ok: false, error: "Le domande a scelta devono avere almeno un'opzione" };
  }
  const settings: CalendarSettings = { questions, pipelineId, stageId, tagIds };

  const data = {
    name: v.name,
    slug: v.slug,
    description: v.description || null,
    hostUserId: v.hostUserId,
    durationMinutes: v.durationMinutes,
    slotIntervalMinutes: v.slotIntervalMinutes,
    bufferMinutes: v.bufferMinutes,
    minAdvanceHours: v.minAdvanceHours,
    maxAdvanceDays: v.maxAdvanceDays,
    locationType: v.locationType,
    locationValue: v.locationValue || null,
    timezone: v.timezone,
    color: v.color,
    active: v.active,
    settings: settings as Prisma.InputJsonValue,
  };

  let id: string;
  try {
    if (v.id) {
      const existing = await ctx.db.calendar.findUnique({ where: { id: v.id }, select: { id: true } });
      if (!existing) return { ok: false, error: "Calendario non trovato" };
      await ctx.db.calendar.update({ where: { id: v.id }, data });
      id = v.id;
    } else {
      id = (await ctx.db.calendar.create({ data: { ...data, companyId: ctx.companyId } })).id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: `Lo slug "${v.slug}" è già usato da un altro calendario` };
    }
    throw e;
  }

  await ctx.db.availability.deleteMany({ where: { calendarId: id } });
  if (v.availability.length) {
    await ctx.db.availability.createMany({
      data: v.availability.map(a => ({ companyId: ctx.companyId, calendarId: id, ...a })),
    });
  }

  revalidatePath(`/${ctx.slug}/calendars`);
  return { ok: true, data: { id } };
});

/**
 * Un calendario con appuntamenti non si elimina (la cascade li cancellerebbe
 * dallo storico dei contatti): si disattiva.
 */
export const deleteCalendar = companyAction(async (ctx, id: string): Promise<Result<{ deactivated: boolean }>> => {
  const count = await ctx.db.appointment.count({ where: { calendarId: id } });
  if (count > 0) {
    await ctx.db.calendar.update({ where: { id }, data: { active: false } });
    revalidatePath(`/${ctx.slug}/calendars`);
    return { ok: true, data: { deactivated: true } };
  }
  await ctx.db.calendar.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/calendars`);
  return { ok: true, data: { deactivated: false } };
});

export const toggleCalendarActive = companyAction(async (ctx, id: string, active: boolean): Promise<Result> => {
  await ctx.db.calendar.update({ where: { id }, data: { active } });
  revalidatePath(`/${ctx.slug}/calendars`);
  return { ok: true };
});

export const disconnectGoogleCalendar = companyAction(async (ctx): Promise<Result> => {
  await disconnectGoogle(ctx.companyId, ctx.userId);
  revalidatePath(`/${ctx.slug}/calendars`);
  return { ok: true };
});

const rulesSchema = z.array(z.object({
  offsetMinutes: z.number().int().min(5).max(30 * 24 * 60),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  active: z.boolean(),
})).max(10);

/** Sostituisce l'insieme dei promemoria dell'azienda. */
export const saveReminderRules = companyAction(async (ctx, rules: z.input<typeof rulesSchema>): Promise<Result> => {
  const parsed = rulesSchema.safeParse(rules);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Promemoria non validi" };
  const seen = new Set<string>();
  const unique = parsed.data.filter(r => {
    const k = `${r.offsetMinutes}:${r.channel}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  await ctx.db.reminderRule.deleteMany({});
  if (unique.length) {
    await ctx.db.reminderRule.createMany({ data: unique.map(r => ({ ...r, companyId: ctx.companyId })) });
  }
  revalidatePath(`/${ctx.slug}/calendars`);
  return { ok: true };
});
