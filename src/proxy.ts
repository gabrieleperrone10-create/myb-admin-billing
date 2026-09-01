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
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // TODO fase 3: sostituire con il redirect all'azienda di default dell'utente,
  // che richiede una query al DB e quindi va in src/app/page.tsx, non qui.
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
