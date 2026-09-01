import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { basePrisma, companyDb, type CompanyDb } from "@/lib/db";
import type { Company } from "@prisma/client";

/**
 * Risoluzione dell'azienda corrente.
 *
 * Lo slug arriva dal primo segmento dell'URL, quindi e' input NON fidato: chi
 * chiama puo' metterci qualunque cosa. L'autorita' non viene da li', viene dalla
 * sessione Clerk incrociata con CompanyMember. Lo slug dice solo *quale* azienda
 * si sta chiedendo; se l'utente non ne e' membro, non esiste.
 *
 * Questo vale in particolare per le server action: sono endpoint POST autonomi,
 * la guardia del layout non le copre, quindi ognuna richiama questa funzione.
 */

/** Slug che collidono con rotte statiche e renderebbero l'azienda irraggiungibile. */
export const RESERVED_SLUGS = new Set([
  "api", "sign-in", "sign-up", "select-company", "_next", "favicon.ico",
  "manifest.json", "icons", "robots.txt", "sitemap.xml", "opengraph-image",
]);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

export type CompanyContext = {
  company: Company;
  companyId: string;
  slug: string;
  userId: string;
  db: CompanyDb;
};

/**
 * Verifica sessione + membership e restituisce un client gia' filtrato.
 *
 * `cache()` la memoizza per richiesta: layout, pagina, componenti annidati e
 * action possono chiamarla quante volte vogliono, la query parte una volta sola.
 */
export const requireCompany = cache(async (slug: string): Promise<CompanyContext> => {
  if (!slug || RESERVED_SLUGS.has(slug) || !SLUG_PATTERN.test(slug)) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const membership = await basePrisma.companyMember.findFirst({
    where:   { clerkUserId: userId, company: { slug, active: true } },
    include: { company: true },
  });

  // 404 e non 403: un utente non deve poter distinguere "azienda inesistente"
  // da "azienda che esiste ma non e' tua".
  if (!membership) notFound();

  return {
    company:   membership.company,
    companyId: membership.companyId,
    slug:      membership.company.slug,
    userId,
    db:        companyDb(membership.companyId),
  };
});

/** Aziende dell'utente corrente, per lo switcher e per il redirect da "/". */
export const listMyCompanies = cache(async (): Promise<Company[]> => {
  const { userId } = await auth();
  if (!userId) return [];

  const memberships = await basePrisma.companyMember.findMany({
    where:   { clerkUserId: userId, company: { active: true } },
    include: { company: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return memberships.map(m => m.company);
});

/**
 * Variante per i Route Handler.
 *
 * notFound()/redirect() di next/navigation lanciano un segnale pensato per
 * l'albero di render React (intercettato dal boundary not-found.tsx piu'
 * vicino); un Route Handler non ha un albero React, quindi qui si ritorna
 * direttamente una NextResponse invece di lanciare.
 *
 * Lo slug arriva dal query param ?company=, perche' le API route restano
 * fuori dal prefisso /[company] dell'URL.
 */
export async function requireCompanyFromRequest(
  req: Request,
): Promise<{ ctx: CompanyContext } | { response: NextResponse }> {
  const slug = new URL(req.url).searchParams.get("company") ?? "";

  if (!slug || RESERVED_SLUGS.has(slug) || !SLUG_PATTERN.test(slug)) {
    return { response: NextResponse.json({ error: "Azienda non specificata" }, { status: 400 }) };
  }

  const { userId } = await auth();
  if (!userId) {
    return { response: NextResponse.json({ error: "Non autenticato" }, { status: 401 }) };
  }

  const membership = await basePrisma.companyMember.findFirst({
    where:   { clerkUserId: userId, company: { slug, active: true } },
    include: { company: true },
  });

  if (!membership) {
    return { response: NextResponse.json({ error: "Non trovato" }, { status: 404 }) };
  }

  return {
    ctx: {
      company:   membership.company,
      companyId: membership.companyId,
      slug:      membership.company.slug,
      userId,
      db:        companyDb(membership.companyId),
    },
  };
}
