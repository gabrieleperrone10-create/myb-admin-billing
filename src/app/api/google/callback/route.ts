import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCompanyFromRequest } from "@/lib/company";
import {
  GOOGLE_OAUTH_STATE_COOKIE, GoogleCalendarUserError, exchangeCodeAndConnect, googleRedirectUri,
} from "@/lib/booking/google";

function sameState(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * GET /api/google/callback?code=&state=
 *
 * Redirect URI registrato su Google Cloud: `${origin}/api/google/callback`.
 * Verifica lo state contro il cookie, poi la membership (sessione Clerk +
 * slug salvato nel cookie), scambia il codice e salva il refresh token cifrato.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  let saved: { state?: string; slug?: string } = {};
  try { saved = JSON.parse(req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? "{}"); } catch { /* cookie corrotto */ }

  const slug = typeof saved.slug === "string" ? saved.slug : "";
  const done = (status: string, message?: string) => {
    const url = new URL(slug ? `/${slug}/calendars` : "/", req.nextUrl.origin);
    url.searchParams.set("google", status);
    if (message) url.searchParams.set("message", message.slice(0, 300));
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return res;
  };

  const state = sp.get("state") ?? "";
  if (!saved.state || !state || !sameState(saved.state, state) || !slug) {
    return done("error", "Sessione di collegamento scaduta o non valida: riprova.");
  }
  if (sp.get("error")) return done("error", sp.get("error") === "access_denied" ? "Autorizzazione negata." : "Google ha rifiutato il collegamento.");
  const code = sp.get("code");
  if (!code) return done("error", "Codice di autorizzazione mancante.");

  // requireCompanyFromRequest legge lo slug da ?company=: si costruisce una
  // richiesta equivalente con lo slug del cookie (la sessione e' quella reale).
  const probe = new URL(req.url);
  probe.search = `?company=${encodeURIComponent(slug)}`;
  const r = await requireCompanyFromRequest(new Request(probe));
  if ("response" in r) return done("error", "Accesso all'azienda non consentito.");

  try {
    await exchangeCodeAndConnect({
      code,
      redirectUri: googleRedirectUri(req.nextUrl.origin),
      companyId: r.ctx.companyId,
      clerkUserId: r.ctx.userId,
    });
    return done("connected");
  } catch (e) {
    console.error("[google] callback:", e);
    return done("error", e instanceof GoogleCalendarUserError ? e.message : "Collegamento non riuscito, riprova.");
  }
}
