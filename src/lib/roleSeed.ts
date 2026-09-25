import "server-only";
import { ALL_SECTIONS } from "@/lib/permissions";
import type { AppSection, PermissionLevel } from "@prisma/client";
import type { CompanyDb } from "@/lib/db";

/**
 * Non e' una server action: prima lo era (`export async function
 * seedDefaultRoles` in un file "use server"), il che la rendeva un endpoint POST
 * raggiungibile con un companyId e un ownerClerkId a scelta del chiamante —
 * bastava indovinare il companyId di un'azienda appena creata e senza ruoli per
 * assegnarsi Owner. Qui e' una funzione di libreria, chiamabile solo da un
 * contesto gia' passato per requireCompany().
 */

type RolePreset = {
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  perms: (s: AppSection) => PermissionLevel;
  /** Visibilita' dei dati per sezione (default: tutti) */
  scope?: (s: AppSection) => "ALL" | "OWN";
};

const PRESETS: RolePreset[] = [
  {
    name: "Owner",
    description: "Accesso completo a tutto il sistema",
    color: "#dc2626",
    isSystem: true,
    perms: () => "FULL",
  },
  {
    name: "Admin",
    description: "Accesso completo tranne la gestione degli Owner",
    color: "#f97316",
    isSystem: true,
    perms: () => "FULL",
  },
  {
    name: "Manager",
    description: "Accesso operativo completo, visualizzazione impostazioni",
    color: "#8b5cf6",
    isSystem: false,
    perms: s => (["SETTINGS", "USERS"] as AppSection[]).includes(s) ? "VIEW" : "EDIT",
  },
  {
    name: "Editor",
    description: "Crea e modifica contenuti formativi",
    color: "#4f7deb",
    isSystem: false,
    perms: s => (["DASHBOARD", "ACADEMY", "SOP", "EVENTS", "KNOWLEDGE", "TEAM"] as AppSection[]).includes(s) ? "EDIT" : "NONE",
  },
  {
    name: "Venditore",
    description: "Lavora solo sui contatti assegnati: CRM, task, calendario e i relativi clienti e contratti",
    color: "#14b8a6",
    isSystem: false,
    perms: s => (["CONTACTS", "PIPELINES", "CONVERSATIONS", "TASKS", "CALENDARS"] as AppSection[]).includes(s) ? "EDIT"
      : (["DASHBOARD", "REPORTS", "CLIENTS", "CONTRACTS", "INVOICES", "FORMS", "KNOWLEDGE", "ACADEMY", "SOP", "EVENTS"] as AppSection[]).includes(s) ? "VIEW"
      : "NONE",
    scope: () => "OWN",
  },
  {
    name: "Viewer",
    description: "Solo visualizzazione di tutte le sezioni",
    color: "#6b7280",
    isSystem: false,
    perms: () => "VIEW",
  },
];

/**
 * Crea un ruolo predefinito (es. "Venditore") in un'azienda che ha gia' dei
 * ruoli. Non duplica: se esiste un ruolo con lo stesso nome restituisce quello.
 */
export async function createPresetRole(db: CompanyDb, companyId: string, name: string) {
  const preset = PRESETS.find(p => p.name === name && !p.isSystem);
  if (!preset) throw new Error("Ruolo predefinito sconosciuto");
  const existing = await db.appRole.findFirst({ where: { name: preset.name } });
  if (existing) return existing;
  return db.appRole.create({
    data: {
      companyId,
      name: preset.name,
      description: preset.description,
      color: preset.color,
      isSystem: false,
      permissions: {
        create: ALL_SECTIONS.map(section => ({
          companyId,
          section,
          level: preset.perms(section),
          scope: preset.scope?.(section) ?? "ALL",
        })),
      },
    },
  });
}

export async function seedDefaultRoles(db: CompanyDb, companyId: string, ownerClerkId?: string) {
  const existing = await db.appRole.count();
  if (existing > 0) return;

  for (const preset of PRESETS) {
    await db.appRole.create({
      data: {
        companyId,
        name: preset.name,
        description: preset.description,
        color: preset.color,
        isSystem: preset.isSystem,
        permissions: {
          create: ALL_SECTIONS.map(section => ({
            companyId,
            section,
            level: preset.perms(section),
            scope: preset.scope?.(section) ?? "ALL",
          })),
        },
      },
    });
  }

  // Il primo utente che apre le impostazioni utenti di un'azienda senza ruoli
  // diventa automaticamente Owner di quell'azienda.
  if (ownerClerkId) {
    const owner = await db.appRole.findFirst({ where: { name: "Owner" } });
    if (owner) {
      await db.appUserRole.create({
        data: { companyId, clerkUserId: ownerClerkId, roleId: owner.id },
      });
    }
  }
}
