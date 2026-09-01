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
    name: "Viewer",
    description: "Solo visualizzazione di tutte le sezioni",
    color: "#6b7280",
    isSystem: false,
    perms: () => "VIEW",
  },
];

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
