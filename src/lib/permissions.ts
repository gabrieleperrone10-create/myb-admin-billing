import type { AppSection } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";

export const ALL_SECTIONS: AppSection[] = [
  "DASHBOARD", "INVOICES", "CREDIT_NOTES", "CLIENTS", "EXPENSES", "CONTRACTS",
  "PRODUCTS", "PAYMENTS", "DEPOSITS", "ACADEMY", "SOP",
  "EVENTS", "AUTOMATIONS", "TEAM", "SETTINGS", "KNOWLEDGE", "USERS", "OBJECTIVES",
];

export type PermLevel = "NONE" | "VIEW" | "EDIT" | "FULL";
export type SectionPermissions = Record<AppSection, PermLevel>;

const LEVEL_ORDER: PermLevel[] = ["NONE", "VIEW", "EDIT", "FULL"];

function higher(a: PermLevel, b: PermLevel): PermLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function fullPerms(): SectionPermissions {
  return Object.fromEntries(ALL_SECTIONS.map(s => [s, "FULL"])) as SectionPermissions;
}

export function emptyPerms(): SectionPermissions {
  return Object.fromEntries(ALL_SECTIONS.map(s => [s, "NONE"])) as SectionPermissions;
}

/**
 * Prende `db`/`companyId`/`clerkUserId` gia' verificati da requireCompany(),
 * invece di richiamare auth() al proprio interno: prima veniva avvolta in
 * try/catch perche' auth() lanciava senza clerkMiddleware(), e quel catch
 * ritornava fullPerms() — cioe' accesso pieno a chiunque. Con clerkMiddleware
 * attivo e l'utente gia' autenticato da chi chiama, non c'e' piu' nulla da
 * intercettare.
 *
 * Due bug corretti rispetto alla versione mono-azienda:
 *  - il conteggio delle assegnazioni era globale (tutte le aziende): un'azienda
 *    con RBAC configurato faceva sembrare "vuoto" anche il conteggio di
 *    un'altra azienda che non l'aveva ancora configurato, o viceversa;
 *  - la ricerca dei ruoli dell'utente non filtrava per azienda: un ruolo
 *    posseduto nell'azienda A avrebbe dato accesso anche nell'azienda B.
 *
 * L'unica via di fuga rimasta e' deliberata: se QUESTA azienda non ha ancora
 * nessuna assegnazione (bootstrap), l'accesso e' pieno — altrimenti nessuno
 * potrebbe mai raggiungere Impostazioni > Utenti per farsi assegnare Owner la
 * prima volta. Una volta che l'azienda ha almeno un'assegnazione, un membro
 * senza ruolo vede tutto vuoto: fallisce chiuso, non aperto.
 */
export async function getUserPermissions(
  db: CompanyDb,
  companyId: string,
  clerkUserId: string,
): Promise<SectionPermissions> {
  const totalAssignments = await db.appUserRole.count({ where: { companyId } });
  if (totalAssignments === 0) return fullPerms();

  const userRoles = await db.appUserRole.findMany({
    where: { companyId, clerkUserId },
    include: { role: { include: { permissions: true } } },
  });

  if (userRoles.length === 0) return emptyPerms();

  const merged = emptyPerms();
  for (const { role } of userRoles) {
    for (const p of role.permissions) {
      merged[p.section] = higher(merged[p.section], p.level as PermLevel);
    }
  }
  return merged;
}

export function canView(p: SectionPermissions, s: AppSection) {
  return LEVEL_ORDER.indexOf(p[s]) >= LEVEL_ORDER.indexOf("VIEW");
}
export function canEdit(p: SectionPermissions, s: AppSection) {
  return LEVEL_ORDER.indexOf(p[s]) >= LEVEL_ORDER.indexOf("EDIT");
}
export function canFull(p: SectionPermissions, s: AppSection) {
  return p[s] === "FULL";
}
