import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { AppSection } from "@prisma/client";

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

export async function getUserPermissions(): Promise<SectionPermissions> {
  try {
    const { userId } = await auth();
    if (!userId) return fullPerms();

    const totalAssignments = await prisma.appUserRole.count();
    if (totalAssignments === 0) return fullPerms();

    const userRoles = await prisma.appUserRole.findMany({
      where: { clerkUserId: userId },
      include: { role: { include: { permissions: true } } },
    });

    if (userRoles.length === 0) return fullPerms();

    const merged = emptyPerms();
    for (const { role } of userRoles) {
      for (const p of role.permissions) {
        merged[p.section] = higher(merged[p.section], p.level as PermLevel);
      }
    }
    return merged;
  } catch {
    return fullPerms();
  }
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
