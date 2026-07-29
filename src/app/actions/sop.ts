"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import type { AttachmentType } from "@prisma/client";

export async function createFolder(data: { name: string; color?: string }) {
  const folder = await prisma.sopFolder.create({ data });
  revalidatePath("/sop");
  return folder;
}

export async function updateFolder(id: string, data: { name?: string; color?: string }) {
  const folder = await prisma.sopFolder.update({ where: { id }, data });
  revalidatePath("/sop");
  return folder;
}

export async function deleteFolder(id: string) {
  await prisma.sopFolder.delete({ where: { id } });
  revalidatePath("/sop");
}

export async function createSopTag(data: { name: string; color?: string }) {
  const tag = await prisma.sopTag.create({ data });
  revalidatePath("/sop");
  return tag;
}

export async function createSop(data: {
  title: string;
  folderId?: string;
  roles?: string[];
  tagIds?: string[];
}) {
  const sop = await prisma.sop.create({
    data: {
      title: data.title,
      folderId: data.folderId || null,
      roles: data.roles ?? [],
      tags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId })) }
        : undefined,
    },
  });
  revalidatePath("/sop");
  return sop;
}

export async function updateSop(id: string, data: {
  title?: string;
  content?: object;
  folderId?: string | null;
  roles?: string[];
  published?: boolean;
  tagIds?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { tagIds, content, roles, ...rest } = data;

    await prisma.sop.update({
      where: { id },
      data: {
        ...rest,
        ...(roles !== undefined && { roles }),
        ...(content !== undefined && { content: content as never }),
      },
    });

    if (tagIds !== undefined) {
      await prisma.sopSopTag.deleteMany({ where: { sopId: id } });
      if (tagIds.length > 0) {
        await prisma.sopSopTag.createMany({
          data: tagIds.map(tagId => ({ sopId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[updateSop] error:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteSop(id: string) {
  await prisma.sop.delete({ where: { id } });
  revalidatePath("/sop");
}

export async function addSopAttachmentLink(data: {
  sopId: string;
  name: string;
  url: string;
}) {
  const att = await prisma.sopAttachment.create({
    data: { sopId: data.sopId, type: "LINK", name: data.name, url: data.url },
  });
  revalidatePath(`/sop/${data.sopId}`);
  return att;
}

export async function addSopAttachmentFile(formData: FormData) {
  const sopId = formData.get("sopId") as string;
  const file = formData.get("file") as File;
  const blob = await put(`sop/${sopId}/${file.name}`, file, { access: "public" });
  const att = await prisma.sopAttachment.create({
    data: { sopId, type: "FILE", name: file.name, url: blob.url, size: file.size },
  });
  revalidatePath(`/sop/${sopId}`);
  return att;
}

export async function deleteSopAttachment(id: string, sopId: string, blobUrl?: string) {
  if (blobUrl) { try { await del(blobUrl); } catch {} }
  await prisma.sopAttachment.delete({ where: { id } });
  revalidatePath(`/sop/${sopId}`);
}
