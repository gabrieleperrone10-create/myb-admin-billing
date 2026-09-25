import type { AppSection } from "@prisma/client";

/**
 * Percorso (senza slug) -> sezione dei permessi. Vince il prefisso piu' lungo:
 * "/settings/users" e' USERS, il resto di "/settings" e' SETTINGS.
 * I percorsi non elencati (es. /profile) non richiedono permessi di sezione.
 */
const PATH_SECTIONS: [string, AppSection][] = [
  ["/dashboard", "DASHBOARD"],
  ["/clients", "CLIENTS"],
  ["/contracts", "CONTRACTS"],
  ["/invoices", "INVOICES"],
  ["/credit-notes", "CREDIT_NOTES"],
  ["/payments", "PAYMENTS"],
  ["/expenses", "EXPENSES"],
  ["/deposits", "DEPOSITS"],
  ["/products", "PRODUCTS"],
  ["/objectives", "OBJECTIVES"],
  ["/events", "EVENTS"],
  ["/team", "TEAM"],
  ["/academy", "ACADEMY"],
  ["/sop", "SOP"],
  ["/knowledge", "KNOWLEDGE"],
  ["/automations", "AUTOMATIONS"],
  ["/settings", "SETTINGS"],
  ["/settings/users", "USERS"],
  ["/settings/roles", "USERS"],
  ["/contacts", "CONTACTS"],
  ["/opportunities", "PIPELINES"],
  ["/conversations", "CONVERSATIONS"],
  ["/forms", "FORMS"],
  ["/calendars", "CALENDARS"],
  ["/tasks", "TASKS"],
  ["/reports", "REPORTS"],
];

export function sectionForPath(pathWithoutSlug: string): AppSection | null {
  let best: [string, AppSection] | null = null;
  for (const entry of PATH_SECTIONS) {
    const [prefix] = entry;
    if ((pathWithoutSlug === prefix || pathWithoutSlug.startsWith(prefix + "/")) && (!best || prefix.length > best[0].length)) {
      best = entry;
    }
  }
  return best ? best[1] : null;
}
