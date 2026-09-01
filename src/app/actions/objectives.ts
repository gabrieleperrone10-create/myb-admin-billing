"use server";

import { revalidatePath } from "next/cache";
import type { ObjectivePeriod, KRType, KRDataSource } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";
import { companyAction } from "@/lib/companyAction";
import { getPeriodDates, krProgress, objectiveProgress } from "@/lib/objectives";

async function resolveDataSource(db: CompanyDb, source: KRDataSource, start: Date, end: Date): Promise<number> {
  switch (source) {
    case "INVOICES_AMOUNT": {
      const r = await db.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: start, lte: end } }, _sum: { amount: true } });
      return r._sum.amount ?? 0;
    }
    case "CLIENT_COUNT":
      return db.client.count({ where: { createdAt: { gte: start, lte: end } } });
    case "EXPENSES_AMOUNT": {
      const r = await db.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } });
      return r._sum.amount ?? 0;
    }
    case "CONTRACT_COUNT":
      return db.contract.count({ where: { startDate: { gte: start, lte: end }, active: true } });
  }
}

export const getObjectives = companyAction(async (ctx, year: number, period?: string) => {
  const where = period && period !== "ALL"
    ? { year, period: period as ObjectivePeriod }
    : { year };

  const objectives = await ctx.db.objective.findMany({
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
      const current = kr.dataSource ? await resolveDataSource(ctx.db, kr.dataSource, start, end) : (kr.current ?? 0);
      return { ...kr, current };
    }));

    return { ...obj, keyResults: krs, progress: objectiveProgress(krs) };
  }));
});

export const createObjective = companyAction(async (ctx, data: {
  title: string; description?: string; emoji: string; color: string;
  period: ObjectivePeriod; year: number; startDate?: string; endDate?: string; ownerId?: string;
  keyResults?: { title: string; type: KRType; target?: number; unit?: string; dataSource?: KRDataSource }[];
}) => {
  const obj = await ctx.db.objective.create({
    data: {
      companyId: ctx.companyId,
      title: data.title, description: data.description || null, emoji: data.emoji,
      color: data.color, period: data.period, year: data.year,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      ownerId: data.ownerId || null,
    },
  });
  if (data.keyResults?.length) {
    await ctx.db.keyResult.createMany({
      data: data.keyResults.filter(kr => kr.title.trim()).map(kr => ({
        companyId: ctx.companyId,
        objectiveId: obj.id, title: kr.title, type: kr.type,
        target: kr.target ?? null, unit: kr.unit || null,
        dataSource: kr.dataSource ?? null,
      })),
    });
  }
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const updateObjective = companyAction(async (ctx, id: string, data: Partial<{
  title: string; description: string; emoji: string; color: string; period: ObjectivePeriod;
  year: number; startDate: string; endDate: string;
}>) => {
  await ctx.db.objective.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const deleteObjective = companyAction(async (ctx, id: string) => {
  await ctx.db.objective.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const createKeyResult = companyAction(async (ctx, data: {
  objectiveId: string; title: string; type: KRType;
  target?: number; unit?: string; dataSource?: KRDataSource; dueDate?: string;
}) => {
  await ctx.db.keyResult.create({
    data: {
      companyId: ctx.companyId,
      objectiveId: data.objectiveId, title: data.title, type: data.type,
      target: data.target ?? null, unit: data.unit || null,
      dataSource: data.dataSource ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const updateKeyResult = companyAction(async (ctx, id: string, data: Partial<{
  current: number; completed: boolean; title: string; target: number; unit: string;
}>) => {
  await ctx.db.keyResult.update({ where: { id }, data });
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const deleteKeyResult = companyAction(async (ctx, id: string) => {
  await ctx.db.keyResult.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/objectives`);
});

export const addCheckIn = companyAction(async (ctx, objectiveId: string, note: string) => {
  await ctx.db.checkIn.create({ data: { companyId: ctx.companyId, objectiveId, note } });
  revalidatePath(`/${ctx.slug}/objectives`);
});
