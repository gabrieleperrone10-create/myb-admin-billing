import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendContractExpiringEmails } from "@/app/actions/email";

const THRESHOLDS = [30, 7, 1, 0] as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automation = await prisma.automation.findUnique({ where: { type: "CONTRACT_EXPIRING" } });
  if (!automation?.active) {
    return NextResponse.json({ skipped: true, reason: "automation disabled" });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const contracts = await prisma.contract.findMany({
    where:  { active: true, endDate: { not: null } },
    select: { id: true, endDate: true },
  });

  const notified: { id: string; daysUntil: number }[] = [];
  const failed:   string[] = [];

  for (const contract of contracts) {
    const end = new Date(contract.endDate as Date);
    end.setUTCHours(0, 0, 0, 0);
    const daysUntil = Math.round((end.getTime() - today.getTime()) / 864e5);

    if (!THRESHOLDS.includes(daysUntil as typeof THRESHOLDS[number])) continue;

    const result = await sendContractExpiringEmails(contract.id, daysUntil as typeof THRESHOLDS[number]);
    if (result.ok) {
      notified.push({ id: contract.id, daysUntil });
    } else {
      failed.push(contract.id);
    }
  }

  await prisma.automation.update({ where: { type: "CONTRACT_EXPIRING" }, data: { lastRunAt: new Date() } });

  return NextResponse.json({ ok: true, notified, failed });
}
