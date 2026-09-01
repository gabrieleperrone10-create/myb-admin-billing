"use server";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { companyAction } from "@/lib/companyAction";

export const createCategory = companyAction(async (ctx, data: {
  name: string;
  color?: string;
  tagIds?: string[];
}) => {
  const category = await ctx.db.courseCategory.create({
    data: {
      companyId: ctx.companyId,
      name: data.name,
      color: data.color ?? "#4f7deb",
      // nested write: CourseCategoryTag non passa dall'estensione
      requiredTags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId, companyId: ctx.companyId })) }
        : undefined,
    },
  });
  revalidatePath(`/${ctx.slug}/academy`);
  return category;
});

export const createCourse = companyAction(async (ctx, data: {
  categoryId: string;
  title: string;
  description?: string;
  coverImage?: string;
}) => {
  const course = await ctx.db.course.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/academy`);
  return course;
});

export const updateCourse = companyAction(async (ctx, id: string, data: {
  title?: string;
  description?: string;
  coverImage?: string;
  published?: boolean;
  order?: number;
}) => {
  const course = await ctx.db.course.update({ where: { id }, data });
  revalidatePath(`/${ctx.slug}/academy`);
  revalidatePath(`/${ctx.slug}/academy/${id}`);
  return course;
});

export const createModule = companyAction(async (ctx, data: {
  courseId: string;
  title: string;
  parentId?: string;
  order?: number;
}) => {
  const mod = await ctx.db.module.create({ data: { companyId: ctx.companyId, ...data } });
  revalidatePath(`/${ctx.slug}/academy/${data.courseId}`);
  return mod;
});

export const deleteModule = companyAction(async (ctx, id: string, courseId: string) => {
  await ctx.db.module.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
});

export const createLesson = companyAction(async (ctx, data: {
  moduleId: string;
  courseId: string;
  title: string;
  videoUrl?: string;
  content?: string;
  duration?: number;
  order?: number;
}) => {
  const { courseId, ...rest } = data;
  const lesson = await ctx.db.lesson.create({ data: { companyId: ctx.companyId, ...rest } });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
  return lesson;
});

export const updateLesson = companyAction(async (ctx, id: string, courseId: string, data: {
  title?: string;
  videoUrl?: string;
  content?: string;
  duration?: number;
  published?: boolean;
}) => {
  const lesson = await ctx.db.lesson.update({ where: { id }, data });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
  return lesson;
});

export const deleteLesson = companyAction(async (ctx, id: string, courseId: string) => {
  await ctx.db.lesson.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
});

export const addAttachmentLink = companyAction(async (ctx, data: {
  lessonId: string;
  courseId: string;
  name: string;
  url: string;
}) => {
  const att = await ctx.db.lessonAttachment.create({
    data: { companyId: ctx.companyId, lessonId: data.lessonId, type: "LINK", name: data.name, url: data.url },
  });
  revalidatePath(`/${ctx.slug}/academy/${data.courseId}`);
  return att;
});

export const addAttachmentFile = companyAction(async (ctx, formData: FormData) => {
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const file = formData.get("file") as File;

  const blob = await put(`academy/${ctx.companyId}/${lessonId}/${file.name}`, file, { access: "public" });

  const att = await ctx.db.lessonAttachment.create({
    data: {
      companyId: ctx.companyId,
      lessonId,
      type: "FILE",
      name: file.name,
      url: blob.url,
      size: file.size,
    },
  });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
  return att;
});

export const deleteAttachment = companyAction(async (ctx, id: string, courseId: string, blobUrl?: string) => {
  if (blobUrl) {
    try { await del(blobUrl); } catch {}
  }
  await ctx.db.lessonAttachment.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/academy/${courseId}`);
});

export const markLessonComplete = companyAction(async (ctx, memberId: string, lessonId: string) => {
  await ctx.db.lessonProgress.upsert({
    where: { memberId_lessonId: { memberId, lessonId } },
    update: {},
    create: { memberId, lessonId, companyId: ctx.companyId },
  });
});

export const deleteCourse = companyAction(async (ctx, id: string) => {
  await ctx.db.course.delete({ where: { id } });
  revalidatePath(`/${ctx.slug}/academy`);
});
