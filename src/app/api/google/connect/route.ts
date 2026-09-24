import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCompanyFromRequest } from "@/lib/company";
import { GOOGLE_OAUTH_STATE_COOKIE, getGoogleAuthUrl, googleRedirectUri, isGoogleConfigured } from "@/lib/booking/google";

/**
 * GET /api/google/connect?company=<slug>
 *
 * Avvia l'OAuth Google per l'utente corrente nell'azienda indicata. Lo state
 * anti-CSRF e' casuale e viaggia in un cookie httpOnly insieme allo slug: la
 * callback accetta solo lo state che ha emesso questo browser.
 */
export async function GET(req: NextRequest) {
  const r = await requireCompanyFromRequest(req);
  if ("response" in r) return r.response;
  const { slug } = r.ctx;
  const back = new URL(`/${slug}/calendars`, req.nextUrl.origin);

  if (!isGoogleConfigured()) {
    back.searchParams.set("google", "not_configured");
    return NextResponse.redirect(back);
  }

  const state = randomBytes(24).toString("hex");
  const url = getGoogleAuthUrl(googleRedirectUri(req.nextUrl.origin), state);
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, JSON.stringify({ state, slug }), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
