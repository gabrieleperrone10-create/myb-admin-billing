import { Prisma } from "@prisma/client";
import { basePrisma, companyDb, type CompanyDb } from "@/lib/db";
import { corsJson, corsPreflight } from "@/lib/crm/forms/cors";
import { checkRateLimit, clientIp } from "@/lib/crm/forms/rateLimit";
import { MAX_TRACK_PAYLOAD_BYTES, MAX_URL_LENGTH } from "@/lib/crm/forms/shared";
import { logActivity } from "@/lib/crm/activity";
import { UTM_KEYS } from "@/lib/crm/types";

/**
 * Riceve le page view da t.js. Pubblico per costruzione (chiamato dal
 * browser dei visitatori di siti di terzi): l'azienda si riconosce dalla
 * `trackingKey`, che NON e' un segreto (vive nell'HTML pubblico del sito che
 * ha installato lo script) — serve solo a instradare l'evento sull'azienda
 * giusta, non autorizza nulla.
 */
export const dynamic = "force-dynamic";

const DEDUPE_WINDOW_MS = 30_000;

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_TRACK_PAYLOAD_BYTES) {
    return corsJson({ ok: false }, 400);
  }

  let payload: Record<string, unknown>;
  try {
    payload = raw ? JSON.parse(raw) : {};
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw new Error("bad shape");
  } catch {
    return corsJson({ ok: false }, 400);
  }

  const key = typeof payload.key === "string" ? payload.key.trim() : "";
  const vid = typeof payload.vid === "string" ? payload.vid.trim().slice(0, 100) : "";
  const url = typeof payload.url === "string" ? payload.url.trim().slice(0, MAX_URL_LENGTH) : "";
  if (!key || !vid || !url) {
    return corsJson({ ok: false }, 400);
  }

  const ip = clientIp(req);
  if (!checkRateLimit(`track:${key}:${ip}`, { windowMs: 60_000, max: 120 })) {
    return corsJson({ ok: false }, 429);
  }

  // basePrisma: risolve l'azienda da un identificativo pubblico (la
  // trackingKey inviata dal browser, non fidata). Da qui in poi companyDb.
  const company = await basePrisma.company.findUnique({
    where: { trackingKey: key },
    select: { id: true },
  });
  if (!company) {
    return corsJson({ ok: false }, 404);
  }

  const db = companyDb(company.id);

  const path = typeof payload.path === "string" ? payload.path.trim().slice(0, 500) || null : null;
  const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 300) || null : null;
  const referrer = typeof payload.referrer === "string" ? payload.referrer.trim().slice(0, MAX_URL_LENGTH) || null : null;
  const utm = sanitizeUtm(payload.utm);

  // Throttle: la stessa URL dallo stesso visitatore entro 30s non genera una
  // nuova riga (SPA/patch di history che rifirano lo stesso evento, tab che
  // riguadagna il focus, ecc.).
  const recent = await db.pageView.findFirst({
    where: { visitorId: vid, url },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  if (recent && Date.now() - recent.occurredAt.getTime() < DEDUPE_WINDOW_MS) {
    return corsJson({ ok: true, deduped: true });
  }

  const contactId = await findKnownContactId(db, vid);

  const pageView = await db.pageView.create({
    data: {
      companyId: company.id,
      visitorId: vid,
      contactId,
      url,
      path,
      title,
      referrer,
      utm: utm ? (utm as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  if (contactId) {
    await logActivity(db, company.id, {
      contactId,
      type: "PAGE_VIEW",
      data: { pageViewId: pageView.id, url, title: title ?? undefined },
    });
  }

  return corsJson({ ok: true });
}

function sanitizeUtm(raw: unknown): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return Object.keys(out).length ? out : null;
}

/** Un visitatore e' "noto" se una sua PageView o FormSubmission precedente e' gia' collegata a un contatto. */
async function findKnownContactId(db: CompanyDb, visitorId: string): Promise<string | null> {
  const pv = await db.pageView.findFirst({
    where: { visitorId, contactId: { not: null } },
    orderBy: { occurredAt: "desc" },
    select: { contactId: true },
  });
  if (pv?.contactId) return pv.contactId;

  const sub = await db.formSubmission.findFirst({
    where: { visitorId, contactId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { contactId: true },
  });
  return sub?.contactId ?? null;
}
