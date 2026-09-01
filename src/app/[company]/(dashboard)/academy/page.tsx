export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { GraduationCap, BookOpen, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { CreateCategoryModal } from "./CreateCategoryModal";
import { CreateCourseModal } from "./CreateCourseModal";
import { DeleteCourseButton, EditCourseButton } from "./CourseActions";

export default async function AcademyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const { db } = await requireCompany(slug);
  const [categories, totalMembers] = await Promise.all([
    db.courseCategory.findMany({
      include: {
        requiredTags: { include: { tag: true } },
        courses: {
          include: {
            modules: {
              include: { lessons: { include: { progress: true } } },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
    db.teamMember.count({ where: { active: true } }),
  ]);

  return (
    <div className="space-y-6" style={{ maxWidth: 960 }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Academy
          </h1>
          <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
            Corsi interni per la formazione del team. L&apos;accesso è regolato dai tag assegnati.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CreateCategoryModal />
          <CreateCourseModal categories={categories.map(c => ({ id: c.id, name: c.name }))} />
        </div>
      </div>

      {categories.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[8px]"
          style={{ border: "1px dashed var(--border)" }}
        >
          <GraduationCap className="w-10 h-10 mb-3" style={{ color: "var(--fg-3)" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Nessuna categoria</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>Crea una categoria per iniziare ad aggiungere corsi.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map(cat => {
            const totalLessons = cat.courses.reduce((s, c) =>
              s + c.modules.reduce((ms, m) => ms + m.lessons.length, 0), 0);

            return (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: cat.color + "18", color: cat.color, border: `1px solid ${cat.color}30` }}
                  >
                    {cat.name}
                  </span>
                  {cat.requiredTags.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3" style={{ color: "var(--fg-3)" }} />
                      {cat.requiredTags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: tag.color + "18", color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-[11px]" style={{ color: "var(--fg-3)" }}>
                    {cat.courses.length} cors{cat.courses.length === 1 ? "o" : "i"} · {totalLessons} lezioni
                  </span>
                </div>

                {cat.courses.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-8 rounded-[8px] text-[13px]"
                    style={{ border: "1px dashed var(--border)", color: "var(--fg-3)" }}
                  >
                    Nessun corso in questa categoria
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                    {cat.courses.map(course => {
                      const lessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);
                      const completions = course.modules.reduce((s, m) =>
                        s + m.lessons.reduce((ls, l) => ls + l.progress.length, 0), 0);
                      const progress = totalMembers > 0 && lessonCount > 0
                        ? Math.round((completions / (totalMembers * lessonCount)) * 100)
                        : 0;

                      return (
                        <div key={course.id} className="relative group">
                          <EditCourseButton courseId={course.id} defaults={{ title: course.title, description: course.description }} />
                          <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
                        <Link
                          href={`/${slug}/academy/${course.id}`}
                          className="rounded-[8px] overflow-hidden transition-shadow hover:shadow-md block"
                          style={{ border: "1px solid var(--border)", backgroundColor: "#fff" }}
                        >
                          {course.coverImage ? (
                            <div className="h-32 overflow-hidden">
                              <img src={course.coverImage} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div
                              className="h-32 flex items-center justify-center"
                              style={{ backgroundColor: cat.color + "10" }}
                            >
                              <BookOpen className="w-8 h-8" style={{ color: cat.color }} />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{course.title}</p>
                              {!course.published && (
                                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase shrink-0" style={{ backgroundColor: "#f9741618", color: "#c2590a" }}>
                                  bozza
                                </span>
                              )}
                            </div>
                            {course.description && (
                              <p className="text-[12px] line-clamp-2" style={{ color: "var(--fg-3)" }}>{course.description}</p>
                            )}
                            <div className="mt-3 space-y-1">
                              <div className="flex justify-between text-[11px]" style={{ color: "var(--fg-3)" }}>
                                <span>{lessonCount} lezioni · {course.modules.length} moduli</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--subtle)" }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${progress}%`, backgroundColor: cat.color }}
                                />
                              </div>
                            </div>
                          </div>
                        </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
