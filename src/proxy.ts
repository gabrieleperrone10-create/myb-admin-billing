import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Rotte raggiungibili senza sessione Clerk.
 *
 * I cron di Vercel NON hanno sessione: arrivano con `Authorization: Bearer $CRON_SECRET`,
 * che i quattro handler sotto /api/cron controllano già per conto proprio. Senza questa
 * eccezione `auth.protect()` li spegnerebbe tutti.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron/(.*)",
  // CRM: endpoint pubblici (form, tracking, booking) e webhook dei provider.
  // Ognuno si autentica da se': chiave pubblica dell'azienda, firma del
  // webhook (Resend/Svix, Meta X-Hub-Signature-256) o token di gestione.
  "/api/public/(.*)",
  "/api/webhooks/(.*)",
  "/f/(.*)",
  "/book/(.*)",
  "/embed/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Il percorso richiesto, per il controllo di sezione in (dashboard)/template.tsx:
  // i layout non ricevono il pathname, e il template si rirenderizza a ogni
  // navigazione (anche client-side, che passa comunque da qui come richiesta RSC).
  const headers = new Headers(req.headers);
  headers.set("x-app-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
