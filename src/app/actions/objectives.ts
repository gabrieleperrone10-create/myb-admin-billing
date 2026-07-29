"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ObjectivePeriod, KRType, KRDataSource } from "@prisma/client";
import { getPeriodDates, krProgress, objectiveProgress } from "@/lib/objectives";

async function resolveDataSource(source: KRDataSource, start: Date, end: Date): Promise<number> {
  switch (source) {
    case "INVOICES_AMOUNT": {
      const r = await prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: start, lte: end } }, _sum: { amount: true } });
      return r._sum.amount ?? 0;
    }
    case "CLIENT_COUNT":
      return prisma.client.count({ where: { createdAt: { gte: start, lte: end } } });
    case "EXPENSES_AMOUNT": {
      const r = await prisma.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } });
      return r._sum.amount ?? 0;
    }
    case "CONTRACT_COUNT":
      return prisma.contract.count({ where: { startDate: { gte: start, lte: end }, active: true } });
  }
}

export async function getObjectives(year: number, period?: string) {
  const where = period && period !== "ALL"
    ? { year, period: period as ObjectivePeriod }
    : { year };

  const objectives = await prisma.objective.findMany({
    where,
    include: {
      keyResults: { orderBy: { createdAt: "asc" } },
      checkIns: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(objectives.map(async (obj) => {
    const { start, end } = obj.startDate && obj.endDate
      ? { start: obj.startDate, end: obj.endDate }
      : getPeriodDates(obj.period, obj.year);

    const krs = await Promise.all(obj.keyResults.map(async (kr) => {
      const current = kr.dataSource ? await resolveDataSource(kr.dataSource, start, end) : (kr.current ?? 0);
      return { ...kr, current };
    }));

    return { ...obj, keyResults: krs, progress: objectiveProgress(krs) };
  }));
}

export async function createObjective(data: {
  title: string; description?: string; emoji: string; color: string;
  period: ObjectivePeriod; year: number; startDate?: string; endDate?: string; ownerId?: string;
  keyResults?: { title: string; type: KRType; target?: number; unit?: string; dataSource?: KRDataSource }[];
}) {
  const obj = await prisma.objective.create({
    data: {
      title: data.title, description: data.description || null, emoji: data.emoji,
      color: data.color, period: data.period, year: data.year,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      ownerId: data.ownerId || null,
    },
  });
  if (data.keyResults?.length) {
    await prisma.keyResult.createMany({
      data: data.keyResults.filter(kr => kr.title.trim()).map(kr => ({
        objectiveId: obj.id, title: kr.title, type: kr.type,
        target: kr.target ?? null, unit: kr.unit || null,
        dataSource: kr.dataSource ?? null,
      })),
    });
  }
  revalidatePath("/objectives");
}

export async function updateObjective(id: string, data: Partial<{
  title: string; description: string; emoji: string; color: string; period: ObjectivePeriod;
  year: number; startDate: string; endDate: string;
}>) {
  await prisma.objective.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });
  revalidatePath("/objectives");
}

export async function deleteObjective(id: string) {
  await prisma.objective.delete({ where: { id } });
  revalidatePath("/objectives");
}

export async function createKeyResult(data: {
  objectiveId: string; title: string; type: KRType;
  target?: number; unit?: string; dataSource?: KRDataSource; dueDate?: string;
}) {
  await prisma.keyResult.create({
    data: {
      objectiveId: data.objectiveId, title: data.title, type: data.type,
      target: data.target ?? null, unit: data.unit || null,
      dataSource: data.dataSource ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  revalidatePath("/objectives");
}

export async function updateKeyResult(id: string, data: Partial<{
  current: number; completed: boolean; title: string; target: number; unit: string;
}>) {
  await prisma.keyResult.update({ where: { id }, data });
  revalidatePath("/objectives");
}

export async function deleteKeyResult(id: string) {
  await prisma.keyResult.delete({ where: { id } });
  revalidatePath("/objectives");
}

export async function addCheckIn(objectiveId: string, note: string) {
  await prisma.checkIn.create({ data: { objectiveId, note } });
  revalidatePath("/objectives");
}
