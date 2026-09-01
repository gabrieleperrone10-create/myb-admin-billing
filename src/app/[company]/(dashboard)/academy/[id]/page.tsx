export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, EyeOff } from "lucide-react";
import Link from "next/link";
import { AddModuleModal } from "./AddModuleModal";
import { AddLessonModal } from "./AddLessonModal";
import { LessonPlayer } from "./LessonPlayer";
import { PublishToggle } from "./PublishToggle";
import { CourseLayoutClient } from "./CourseLayoutClient";
import type { Module, Lesson, LessonProgress, LessonAttachment } from "@prisma/client";

type LessonFull = Lesson & { progress: LessonProgress[]; attachments: LessonAttachment[] };
type ModuleFull = Module & { children: ModuleFull[]; lessons: LessonFull[] };

function flatLessons(modules: ModuleFull[]): LessonFull[] {
  return modules.flatMap(m => [...m.lessons, ...flatLessons(m.children)]);
}

function ModuleTree({
  modules,
  courseId,
  currentLessonId,
  accentColor,
  depth = 0,
}: {
  modules: ModuleFull[];
  courseId: string;
  currentLessonId?: string;
  accentColor: string;
  depth?: number;
}) {
  return (
    <>
      {modules.map((mod, _mi) => (
        <div key={mod.id}>
          {/* Module header */}
          <div
            className="flex items-center justify-between py-2"
            style={{
              backgroundColor: depth === 0 ? "var(--subtle)" : "var(--bg)",
              paddingLeft: `${16 + depth * 12}px`,
              paddingRight: 8,
              borderTop: depth === 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--fg-2)" }}>
              {depth > 0 && <span style={{ color: "var(--fg-3)" }}>↳</span>}
              {mod.title}
            </span>
            <div className="flex items-center gap-1">
              <AddModuleModal courseId={courseId} parentId={mod.id} label="+" title="Sottocartella" />
              <AddLessonModal moduleId={mod.id} courseId={courseId} />
            </div>
          </div>

          {/* Lessons */}
          {mod.lessons.map((lesson, li) => {
            const active = lesson.id === currentLessonId;
            return (
              <Link
                key={lesson.id}
                href={`/academy/${courseId}?lesson=${lesson.id}`}
                className="flex items-center gap-2.5 py-2.5 transition-colors"
                style={{
                  paddingLeft: `${20 + depth * 12}px`,
                  paddingRight: 12,
                  backgroundColor: active ? accentColor + "10" : "transparent",
                  borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
                  minHeight: "unset",
                }}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0"
                  style={{
                    backgroundColor: active ? accentColor : "var(--subtle)",
                    color: active ? "#fff" : "var(--fg-3)",
                  }}
                >
                  {li + 1}
                </span>
                <span
                  className="text-[13px] flex-1 min-w-0 truncate"
                  style={{ color: active ? "var(--fg)" : "var(--fg-2)", fontWeight: active ? 600 : 400 }}
                >
                  {lesson.title}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!lesson.published && <EyeOff className="w-3 h-3" style={{ color: "var(--fg-3)" }} />}
                  {lesson.attachments.length > 0 && (
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded badge" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>
                      {lesson.attachments.length}
                    </span>
                  )}
                  {lesson.duration && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-3)" }}>{lesson.duration}m</span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Children subfolders */}
          {mod.children.length > 0 && (
            <ModuleTree
              modules={mod.children}
              courseId={courseId}
              currentLessonId={currentLessonId}
              accentColor={accentColor}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id } = await params;
  const { lesson: lessonId } = await searchParams;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      modules: {
        where: { parentId: null },
        include: {
          lessons: {
            include: { progress: true, attachments: true },
            orderBy: { order: "asc" },
          },
          children: {
            include: {
              lessons: {
                include: { progress: true, attachments: true },
                orderBy: { order: "asc" },
              },
              children: {
                include: {
                  lessons: {
                    include: { progress: true, attachments: true },
                    orderBy: { order: "asc" },
                  },
                  children: { include: { lessons: { include: { progress: true, attachments: true } }, children: true } },
                },
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) notFound();

  const allLessons = flatLessons(course.modules as ModuleFull[]);
  const currentLesson = lessonId
    ? allLessons.find(l => l.id === lessonId)
    : allLessons[0];

  const totalLessons = allLessons.length;

  const sidebarContent = course.modules.length === 0 ? (
    <div className="p-4 text-[13px]" style={{ color: "var(--fg-3)" }}>
      Crea una cartella per organizzare le lezioni.
    </div>
  ) : (
    <ModuleTree
      modules={course.modules as ModuleFull[]}
      courseId={course.id}
      currentLessonId={currentLesson?.id}
      accentColor={course.category.color}
    />
  );

  const mainContent = currentLesson ? (
    <LessonPlayer lesson={currentLesson} accentColor={course.category.color} courseId={course.id} />
  ) : (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--r-lg)]"
      style={{ border: "1px dashed var(--border)", minHeight: 260 }}
    >
      <BookOpen className="w-8 h-8 mb-3" style={{ color: "var(--fg-3)" }} />
      <p className="text-[14px]" style={{ color: "var(--fg-3)" }}>
        {course.modules.length === 0
          ? "Crea una cartella e aggiungi la prima lezione."
          : "Seleziona una lezione."}
      </p>
    </div>
  );

  return (
    <div style={{ maxWidth: 1120 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/academy"
          className="flex items-center gap-1 text-[13px] hover:opacity-70"
          style={{ color: "var(--fg-3)", minHeight: "unset" }}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Academy
        </Link>
        <span style={{ color: "var(--fg-3)" }}>/</span>
        <span className="text-[13px] truncate max-w-[180px]" style={{ color: "var(--fg-2)" }}>{course.title}</span>
      </div>

      {/* Course header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider badge"
              style={{ backgroundColor: course.category.color + "18", color: course.category.color }}
            >
              {course.category.name}
            </span>
            {!course.published && (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase badge" style={{ backgroundColor: "#f9741618", color: "#c2590a" }}>
                bozza
              </span>
            )}
          </div>
          <h1 className="font-bold" style={{ fontSize: "clamp(18px, 4vw, 22px)", letterSpacing: "-0.02em", color: "var(--fg)" }}>
            {course.title}
          </h1>
          {course.description && (
            <p className="text-[13px] mt-1 text-fg-3 line-clamp-2">{course.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PublishToggle courseId={course.id} published={course.published} />
          <AddModuleModal courseId={course.id} label="+ Cartella" title="Nuova cartella" />
        </div>
      </div>

      {/* Responsive layout via client component */}
      <CourseLayoutClient
        totalLessons={totalLessons}
        sections={course.modules.length}
        accentColor={course.category.color}
        currentLessonTitle={currentLesson?.title}
        sidebar={sidebarContent}
        content={mainContent}
      />
    </div>
  );
}
