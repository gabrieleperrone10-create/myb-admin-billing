import { NextRequest, NextResponse } from "next/server";
import { forEachCompany, isAuthorizedCron } from "@/lib/cron";
import { sendContractExpiringEmails } from "@/lib/mail";

const THRESHOLDS = [30, 7, 1, 0] as const;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const runs = await forEachCompany("CONTRACT_EXPIRING", async ({ db, company }) => {
    const contracts = await db.contract.findMany({
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

      const result = await sendContractExpiringEmails(
        company.id,
        contract.id,
        daysUntil as typeof THRESHOLDS[number],
      );
      if (result.ok) notified.push({ id: contract.id, daysUntil });
      else failed.push(contract.id);
    }

    return { notified, failed };
  });

  return NextResponse.json({ ok: true, runs });
}
