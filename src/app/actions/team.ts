"use server";
import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";

export const createTeamMember = companyAction(async (ctx, data: {
  name: string;
  email: string;
  role?: string;
  tagIds?: string[];
}) => {
  const member = await ctx.db.teamMember.create({
    data: {
      companyId: ctx.companyId,
      name: data.name,
      email: data.email,
      role: data.role,
      // nested write: la createMany di TeamMemberTag non passa dall'estensione,
      // companyId va portato a mano.
      tags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId, companyId: ctx.companyId })) }
        : undefined,
    },
  });
  revalidatePath(`/${ctx.slug}/team`);
  return member;
});

export const updateTeamMember = companyAction(async (ctx, id: string, data: {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  tagIds?: string[];
}) => {
  const { tagIds, ...rest } = data;
  const member = await ctx.db.teamMember.update({
    where: { id },
    data: {
      ...rest,
      ...(tagIds !== undefined && {
        tags: {
          deleteMany: {},
          create: tagIds.map(tagId => ({ tagId, companyId: ctx.companyId })),
        },
      }),
    },
  });
  revalidatePath(`/${ctx.slug}/team`);
  return member;
});

export const deleteTeamMember = companyAction(async (ctx, id: string) => {
  await ctx.db.teamMember.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/team`);
});

export const createTag = companyAction(async (ctx, data: { name: string; color?: string }) => {
  const tag = await ctx.db.tag.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/team`);
  return tag;
});

export const deleteTag = companyAction(async (ctx, id: string) => {
  await ctx.db.tag.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/team`);
});
