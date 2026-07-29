"use server";
import { prisma } from "@/lib/prisma";
import { EventType, RsvpStatus, RecurrenceType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createEvent(data: {
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
}) {
  const event = await prisma.event.create({ data });
  revalidatePath("/events");
  return event;
}

export async function updateEvent(id: string, data: {
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
}) {
  const event = await prisma.event.update({ where: { id }, data });
  revalidatePath("/events");
  return event;
}

export async function deleteEvent(id: string) {
  await prisma.event.delete({ where: { id } });
  revalidatePath("/events");
}

export async function rsvpEvent(memberId: string, eventId: string, status: RsvpStatus) {
  await prisma.eventRsvp.upsert({
    where: { memberId_eventId: { memberId, eventId } },
    update: { status },
    create: { memberId, eventId, status },
  });
  revalidatePath("/events");
}
