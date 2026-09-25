"use server";
import { revalidatePath } from "next/cache";
import { ALL_SECTIONS } from "@/lib/permissions";
import { seedDefaultRoles, createPresetRole } from "@/lib/roleSeed";
import { companyAction } from "@/lib/companyAction";
import type { AppSection, PermissionLevel, DataScope } from "@prisma/client";

export const getRoles = companyAction(async (ctx) => {
  await seedDefaultRoles(ctx.db, ctx.companyId, ctx.userId);
  return ctx.db.appRole.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      permissions: true,
      _count: { select: { userRoles: true } },
    },
  });
});

export const getRoleById = companyAction(async (ctx, id: string) => {
  return ctx.db.appRole.findUnique({
    where: { id },
    include: { permissions: true },
  });
});

export const createRole = companyAction(async (ctx, data: { name: string; description?: string; color?: string }) => {
  try {
    const role = await ctx.db.appRole.create({
      data: {
        companyId: ctx.companyId,
        name: data.name,
        description: data.description,
        color: data.color ?? "#4f7deb",
        permissions: {
          create: ALL_SECTIONS.map(section => ({ companyId: ctx.companyId, section, level: "NONE" as PermissionLevel })),
        },
      },
    });
    revalidatePath(`/${ctx.slug}/settings/roles`);
    return { ok: true, id: role.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

export const updateRole = companyAction(async (ctx, id: string, data: { name?: string; description?: string; color?: string }) => {
  try {
    await ctx.db.appRole.update({ where: { id }, data });
    revalidatePath(`/${ctx.slug}/settings/roles`);
    revalidatePath(`/${ctx.slug}/settings/roles/${id}`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

export const updateRolePermissions = companyAction(async (
  ctx,
  roleId: string,
  permissions: { section: AppSection; level: PermissionLevel; scope?: DataScope }[],
) => {
  // L'upsert per (roleId, section) non passa dal filtro azienda sul `where`:
  // senza questo controllo un roleId di un'altra azienda verrebbe aggiornato.
  const role = await ctx.db.appRole.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) return { ok: false, error: "Ruolo non trovato" };
  try {
    await ctx.db.$transaction(
      permissions.map(p =>
        ctx.db.appRolePermission.upsert({
          where: { roleId_section: { roleId, section: p.section } },
          create: { companyId: ctx.companyId, roleId, section: p.section, level: p.level, scope: p.scope ?? "ALL" },
          update: { level: p.level, scope: p.scope ?? "ALL" },
        }),
      ),
    );
    revalidatePath(`/${ctx.slug}/settings/roles`);
    revalidatePath(`/${ctx.slug}/settings/roles/${roleId}`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

export const deleteRole = companyAction(async (ctx, id: string) => {
  const role = await ctx.db.appRole.findUnique({ where: { id } });
  if (role?.isSystem) return { ok: false, error: "Non puoi eliminare un ruolo di sistema" };
  try {
    await ctx.db.appRole.delete({ where: { id } });
    revalidatePath(`/${ctx.slug}/settings/roles`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

/** Aggiunge il ruolo predefinito "Venditore" (visibilita' "Solo assegnati"). */
export const createSalesRole = companyAction(async (ctx) => {
  try {
    const role = await createPresetRole(ctx.db, ctx.companyId, "Venditore");
    revalidatePath(`/${ctx.slug}/settings/roles`);
    return { ok: true as const, id: role.id };
  } catch (e: unknown) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
});
