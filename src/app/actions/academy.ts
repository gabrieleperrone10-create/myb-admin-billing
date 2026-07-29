"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import type { AttachmentType } from "@prisma/client";

export async function createCategory(data: {
  name: string;
  color?: string;
  tagIds?: string[];
}) {
  const category = await prisma.courseCategory.create({
    data: {
      name: data.name,
      color: data.color ?? "#4f7deb",
      requiredTags: data.tagIds?.length
        ? { create: data.tagIds.map(tagId => ({ tagId })) }
        : undefined,
    },
  });
  revalidatePath("/academy");
  return category;
}

export async function createCourse(data: {
  categoryId: string;
  title: string;
  description?: string;
  coverImage?: string;
}) {
  const course = await prisma.course.create({ data });
  revalidatePath("/academy");
  return course;
}

export async function updateCourse(id: string, data: {
  title?: string;
  description?: string;
  coverImage?: string;
  published?: boolean;
  order?: number;
}) {
  const course = await prisma.course.update({ where: { id }, data });
  revalidatePath("/academy");
  revalidatePath(`/academy/${id}`);
  return course;
}

export async function createModule(data: {
  courseId: string;
  title: string;
  parentId?: string;
  order?: number;
}) {
  const mod = await prisma.module.create({ data });
  revalidatePath(`/academy/${data.courseId}`);
  return mod;
}

export async function deleteModule(id: string, courseId: string) {
  await prisma.module.delete({ where: { id } });
  revalidatePath(`/academy/${courseId}`);
}

export async function createLesson(data: {
  moduleId: string;
  courseId: string;
  title: string;
  videoUrl?: string;
  content?: string;
  duration?: number;
  order?: number;
}) {
  const { courseId, ...rest } = data;
  const lesson = await prisma.lesson.create({ data: rest });
  revalidatePath(`/academy/${courseId}`);
  return lesson;
}

export async function updateLesson(id: string, courseId: string, data: {
  title?: string;
  videoUrl?: string;
  content?: string;
  duration?: number;
  published?: boolean;
}) {
  const lesson = await prisma.lesson.update({ where: { id }, data });
  revalidatePath(`/academy/${courseId}`);
  return lesson;
}

export async function deleteLesson(id: string, courseId: string) {
  await prisma.lesson.delete({ where: { id } });
  revalidatePath(`/academy/${courseId}`);
}

export async function addAttachmentLink(data: {
  lessonId: string;
  courseId: string;
  name: string;
  url: string;
}) {
  const att = await prisma.lessonAttachment.create({
    data: { lessonId: data.lessonId, type: "LINK", name: data.name, url: data.url },
  });
  revalidatePath(`/academy/${data.courseId}`);
  return att;
}

export async function addAttachmentFile(formData: FormData) {
  const lessonId = formData.get("lessonId") as string;
  const courseId = formData.get("courseId") as string;
  const file = formData.get("file") as File;

  const blob = await put(`academy/${lessonId}/${file.name}`, file, { access: "public" });

  const att = await prisma.lessonAttachment.create({
    data: {
      lessonId,
      type: "FILE",
      name: file.name,
      url: blob.url,
      size: file.size,
    },
  });
  revalidatePath(`/academy/${courseId}`);
  return att;
}

export async function deleteAttachment(id: string, courseId: string, blobUrl?: string) {
  if (blobUrl) {
    try { await del(blobUrl); } catch {}
  }
  await prisma.lessonAttachment.delete({ where: { id } });
  revalidatePath(`/academy/${courseId}`);
}

export async function markLessonComplete(memberId: string, lessonId: string) {
  await prisma.lessonProgress.upsert({
    where: { memberId_lessonId: { memberId, lessonId } },
    update: {},
    create: { memberId, lessonId },
  });
}

export async function deleteCourse(id: string) {
  await prisma.course.delete({ where: { id } });
  revalidatePath("/academy");
}
