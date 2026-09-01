"use server";
import { EventType, RsvpStatus, RecurrenceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";

export const createEvent = companyAction(async (ctx, data: {
  title: string;
  description?: string;
  type: EventType;
  date: Date;
  endDate?: Date;
  location?: string;
  meetUrl?: string;
  published?: boolean;
  recurrence?: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: Date;
}) => {
  const event = await ctx.db.event.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/events`);
  return event;
});

export const updateEvent = companyAction(async (ctx, id: string, data: {
  title?: string;
  description?: string;
  type?: EventType;
  date?: Date;
  endDate?: Date;
  location?: string;
  meetUrl?: string;
  published?: boolean;
  recurrence?: RecurrenceType;
  recurrenceInterval?: number;
  recurrenceEndDate?: Date | null;
}) => {
  const event = await ctx.db.event.update({ where: { id }, data });
  revalidatePath(`/${ctx.slug}/events`);
  return event;
});

export const deleteEvent = companyAction(async (ctx, id: string) => {
  await ctx.db.event.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/events`);
});

export const rsvpEvent = companyAction(async (ctx, memberId: string, eventId: string, status: RsvpStatus) => {
  await ctx.db.eventRsvp.upsert({
    where: { memberId_eventId: { memberId, eventId } },
    update: { status },
    create: { companyId: ctx.companyId, memberId, eventId, status },
  });
  revalidatePath(`/${ctx.slug}/events`);
});
