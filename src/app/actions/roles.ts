"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ALL_SECTIONS } from "@/lib/permissions";
import type { AppSection, PermissionLevel } from "@prisma/client";

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

export async function seedDefaultRoles(ownerClerkId?: string) {
  const existing = await prisma.appRole.count();
  if (existing > 0) return;

  for (const preset of PRESETS) {
    await prisma.appRole.create({
      data: {
        name: preset.name,
        description: preset.description,
        color: preset.color,
        isSystem: preset.isSystem,
        permissions: {
          create: ALL_SECTIONS.map(section => ({
            section,
            level: preset.perms(section),
          })),
        },
      },
    });
  }

  // Auto-assign Owner to the first user accessing the system
  if (ownerClerkId) {
    const owner = await prisma.appRole.findFirst({ where: { name: "Owner" } });
    if (owner) {
      await prisma.appUserRole.create({
        data: { clerkUserId: ownerClerkId, roleId: owner.id },
      });
    }
  }
}

export async function getRoles() {
  await seedDefaultRoles();
  return prisma.appRole.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      permissions: true,
      _count: { select: { userRoles: true } },
    },
  });
}

export async function getRoleById(id: string) {
  return prisma.appRole.findUnique({
    where: { id },
    include: { permissions: true },
  });
}

export async function createRole(data: { name: string; description?: string; color?: string }) {
  try {
    const role = await prisma.appRole.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color ?? "#4f7deb",
        permissions: {
          create: ALL_SECTIONS.map(section => ({ section, level: "NONE" as PermissionLevel })),
        },
      },
    });
    revalidatePath("/settings/roles");
    return { ok: true, id: role.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function updateRole(id: string, data: { name?: string; description?: string; color?: string }) {
  try {
    await prisma.appRole.update({ where: { id }, data });
    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${id}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissions: { section: AppSection; level: PermissionLevel }[],
) {
  try {
    await prisma.$transaction(
      permissions.map(p =>
        prisma.appRolePermission.upsert({
          where: { roleId_section: { roleId, section: p.section } },
          create: { roleId, section: p.section, level: p.level },
          update: { level: p.level },
        }),
      ),
    );
    revalidatePath("/settings/roles");
    revalidatePath(`/settings/roles/${roleId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function deleteRole(id: string) {
  const role = await prisma.appRole.findUnique({ where: { id } });
  if (role?.isSystem) return { ok: false, error: "Non puoi eliminare un ruolo di sistema" };
  try {
    await prisma.appRole.delete({ where: { id } });
    revalidatePath("/settings/roles");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
