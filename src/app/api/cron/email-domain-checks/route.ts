import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { basePrisma } from "@/lib/db";
import { autoCheckDue, runDomainAutoCheck } from "@/lib/email/domains";

/**
 * Rete di sicurezza giornaliera dei controlli dei domini email: esegue i
 * controlli scaduti di tutte le aziende (anche quelle in cui nessuno ha aperto
 * il gestionale) e invia l'avviso agli Owner dopo le 24 ore.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await basePrisma.company.findMany({
    where: { active: true, emailDomain: { not: null } },
    select: { id: true, slug: true, emailDomain: true, emailDomainStatus: true, inboundDomain: true, inboundDomainStatus: true, emailDomainMeta: true },
  });
  const results: { slug: string; result: string }[] = [];
  for (const c of companies) {
    if (!autoCheckDue(c)) continue;
    try {
      results.push({ slug: c.slug, result: await runDomainAutoCheck(c.id) });
    } catch (e) {
      results.push({ slug: c.slug, result: `errore: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return NextResponse.json({ ok: true, results });
}
