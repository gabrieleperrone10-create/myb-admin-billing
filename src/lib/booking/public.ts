import "server-only";
import { basePrisma, companyDb, type CompanyDb } from "@/lib/db";
import type { Company } from "@prisma/client";
import type { BookingCalendar } from "./engine";

/**
 * Risoluzione dei contesti pubblici (niente sessione).
 *
 * `basePrisma` si usa SOLO per trovare l'azienda (da slug) o l'appuntamento
 * (da manageToken, unico globale, selezionando il solo companyId); tutto il
 * resto passa da companyDb(companyId).
 */

export async function resolvePublicCalendar(
  companySlug: string,
  calendarSlug: string,
): Promise<{ company: Company; db: CompanyDb; calendar: BookingCalendar } | null> {
  if (!companySlug || !calendarSlug || companySlug.length > 60 || calendarSlug.length > 80) return null;
  const company = await basePrisma.company.findFirst({ where: { slug: companySlug, active: true } });
  if (!company) return null;
  const db = companyDb(company.id);
  const calendar = await db.calendar.findFirst({
    where: { slug: calendarSlug, active: true },
    include: { availability: true },
  });
  if (!calendar) return null;
  return { company, db, calendar };
}

export async function resolveByManageToken(token: string) {
  if (!token || token.length > 64 || !/^[a-z0-9]+$/i.test(token)) return null;
  const ref = await basePrisma.appointment.findUnique({ where: { manageToken: token }, select: { companyId: true } });
  if (!ref) return null;
  const company = await basePrisma.company.findFirst({ where: { id: ref.companyId, active: true } });
  if (!company) return null;
  const db = companyDb(company.id);
  const appointment = await db.appointment.findUnique({
    where: { manageToken: token },
    include: { calendar: { include: { availability: true } } },
  });
  if (!appointment) return null;
  return { company, db, appointment };
}

// ─── Rate limit best-effort ───────────────────────────────────────────────
// In memoria, per istanza serverless: ferma i loop banali, non un attacco
// distribuito (per quello serve un KV condiviso, vedi report).

const hits = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  }
  return list.length > limit;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export function requestOrigin(req: Request): string {
  return new URL(req.url).origin;
}
