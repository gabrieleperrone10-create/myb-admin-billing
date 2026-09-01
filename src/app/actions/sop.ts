"use server";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { companyAction } from "@/lib/companyAction";

export const createFolder = companyAction(async (ctx, data: { name: string; color?: string }) => {
  const folder = await ctx.db.sopFolder.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/sop`);
  return folder;
});

export const updateFolder = companyAction(async (ctx, id: string, data: { name?: string; color?: string }) => {
  const folder = await ctx.db.sopFolder.update({ where: { id }, data });
  revalidatePath(`/${ctx.slug}/sop`);
  return folder;
});

export const deleteFolder = companyAction(async (ctx, id: string) => {
  await ctx.db.sopFolder.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/sop`);
});

export const createSopTag = companyAction(async (ctx, data: { name: string; color?: string }) => {
  const tag = await ctx.db.sopTag.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/sop`);
  return tag;
});

export const createSop = companyAction(async (ctx, data: {
  title: string;
  folderId?: string;
  roles?: string[];
  tagIds?: string[];
}) => {
  const sop = await ctx.db.sop.create({
    data: {
      companyId: ctx.companyId,
      title: data.title,
      folderId: data.folderId || null,
      roles: data.roles ?? [],
      // nested write: SopSopTag non passa dall'estensione, companyId a mano
      tags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId, companyId: ctx.companyId })) }
        : undefined,
    },
  });
  revalidatePath(`/${ctx.slug}/sop`);
  return sop;
});

export const updateSop = companyAction(async (ctx, id: string, data: {
  title?: string;
  content?: object;
  folderId?: string | null;
  roles?: string[];
  published?: boolean;
  tagIds?: string[];
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { tagIds, content, roles, ...rest } = data;

    await ctx.db.sop.update({
      where: { id },
      data: {
        ...rest,
        ...(roles !== undefined && { roles }),
        ...(content !== undefined && { content: content as never }),
      },
    });

    if (tagIds !== undefined) {
      await ctx.db.sopSopTag.deleteMany({ where: { sopId: id } });
      if (tagIds.length > 0) {
        await ctx.db.sopSopTag.createMany({
          data: tagIds.map(tagId => ({ sopId: id, tagId, companyId: ctx.companyId })),
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
});

export const deleteSop = companyAction(async (ctx, id: string) => {
  await ctx.db.sop.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/sop`);
});

export const addSopAttachmentLink = companyAction(async (ctx, data: {
  sopId: string;
  name: string;
  url: string;
}) => {
  const att = await ctx.db.sopAttachment.create({
    data: { companyId: ctx.companyId, sopId: data.sopId, type: "LINK", name: data.name, url: data.url },
  });
  revalidatePath(`/${ctx.slug}/sop/${data.sopId}`);
  return att;
});

export const addSopAttachmentFile = companyAction(async (ctx, formData: FormData) => {
  const sopId = formData.get("sopId") as string;
  const file = formData.get("file") as File;
  const blob = await put(`sop/${ctx.companyId}/${sopId}/${file.name}`, file, { access: "public" });
  const att = await ctx.db.sopAttachment.create({
    data: { companyId: ctx.companyId, sopId, type: "FILE", name: file.name, url: blob.url, size: file.size },
  });
  revalidatePath(`/${ctx.slug}/sop/${sopId}`);
  return att;
});

export const deleteSopAttachment = companyAction(async (ctx, id: string, sopId: string, blobUrl?: string) => {
  if (blobUrl) { try { await del(blobUrl); } catch {} }
  await ctx.db.sopAttachment.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/sop/${sopId}`);
});
