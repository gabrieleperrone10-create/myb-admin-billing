import "server-only";
import type { Automation, Company } from "@prisma/client";
import { basePrisma, companyDb, type CompanyDb } from "@/lib/db";

/**
 * Autorizzazione dei cron di Vercel.
 *
 * Prima il confronto era inline: `authHeader !== `Bearer ${process.env.CRON_SECRET}``.
 * Con la variabile non impostata quella stringa diventa "Bearer undefined", che un
 * chiamante puo' riprodurre: il controllo passava. Qui la variabile mancante nega.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export type CompanyRunResult<T> = {
  companyId: string;
  slug: string;
  ok: boolean;
  skipped?: string;
  result?: T;
  error?: string;
};

/**
 * Esegue un job una volta per azienda attiva.
 *
 * Il client base non filtrato serve qui perche' un cron non ha sessione Clerk:
 * l'azienda non si ricava da una richiesta, si itera. Ogni azienda gira dentro il
 * proprio try/catch — prima una singola eccezione abortiva l'intera passata, il che
 * in multi-azienda significa che i dati sbagliati di una bloccano la fatturazione
 * di tutte. Sequenziale e non in parallelo: questi job mandano email via Resend e
 * vanno tenuti sotto i limiti di rate.
 */
export async function forEachCompany<T>(
  automationType: string,
  fn: (ctx: { db: CompanyDb; company: Company; automation: Automation }) => Promise<T>,
): Promise<CompanyRunResult<T>[]> {
  const companies = await basePrisma.company.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const results: CompanyRunResult<T>[] = [];

  for (const company of companies) {
    const db = companyDb(company.id);
    const base = { companyId: company.id, slug: company.slug };

    try {
      const automation = await db.automation.findFirst({ where: { type: automationType } });

      if (!automation) {
        results.push({ ...base, ok: true, skipped: "automazione non configurata" });
        continue;
      }
      if (!automation.active) {
        results.push({ ...base, ok: true, skipped: "automazione disattivata" });
        continue;
      }

      const result = await fn({ db, company, automation });

      await db.automation.update({
        where: { companyId_type: { companyId: company.id, type: automationType } },
        data: { lastRunAt: new Date() },
      });

      results.push({ ...base, ok: true, result });
    } catch (e) {
      results.push({ ...base, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return results;
}

/** Mittente e destinatari, per azienda, con fallback sulle env globali. */
export function companyMailIdentity(company: Company) {
  return {
    fromName:  company.emailFromName ?? company.name,
    fromEmail: company.emailFromAddress ?? process.env.EMAIL_FROM ?? "",
    replyTo:   company.emailReplyTo ?? process.env.EMAIL_REPLY_TO ?? "",
  };
}
