"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTeamMember(data: {
  name: string;
  email: string;
  role?: string;
  tagIds?: string[];
}) {
  const member = await prisma.teamMember.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId })) }
        : undefined,
    },
  });
  revalidatePath("/team");
  return member;
}

export async function updateTeamMember(id: string, data: {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  tagIds?: string[];
}) {
  const { tagIds, ...rest } = data;
  const member = await prisma.teamMember.update({
    where: { id },
    data: {
      ...rest,
      ...(tagIds !== undefined && {
        tags: {
          deleteMany: {},
          create: tagIds.map(tagId => ({ tagId })),
        },
      }),
    },
  });
  revalidatePath("/team");
  return member;
}

export async function deleteTeamMember(id: string) {
  await prisma.teamMember.delete({ where: { id } });
  revalidatePath("/team");
}

export async function createTag(data: { name: string; color?: string }) {
  const tag = await prisma.tag.create({ data });
  revalidatePath("/team");
  return tag;
}

export async function deleteTag(id: string) {
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/team");
}
