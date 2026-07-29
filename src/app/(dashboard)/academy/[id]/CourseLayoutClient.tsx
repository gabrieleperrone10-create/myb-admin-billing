"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

export function CourseLayoutClient({
  sidebar,
  content,
  totalLessons,
  sections,
  accentColor,
  currentLessonTitle,
}: {
  sidebar: React.ReactNode;
  content: React.ReactNode;
  totalLessons: number;
  sections: number;
  accentColor: string;
  currentLessonTitle?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* ── Mobile layout ───────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {/* Collapsible module nav toggle */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--r-lg)] transition-colors"
          style={{
            backgroundColor: "var(--surface)",
            border: `1px solid ${sidebarOpen ? accentColor + "60" : "var(--border)"}`,
            minHeight: "unset",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: accentColor + "18" }}
            >
              <BookOpen className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                {currentLessonTitle ? `Lezione selezionata` : "Scegli una lezione"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
                {totalLessons} lezioni · {sections} sezioni
              </p>
            </div>
          </div>
          {sidebarOpen
            ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--fg-3)" }} />
            : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--fg-3)" }} />
          }
        </button>

        {/* Drawer contenuto sidebar */}
        {sidebarOpen && (
          <div
            className="rounded-[var(--r-lg)] overflow-hidden animate-slide-up"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)" }}
          >
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-[12px] font-semibold" style={{ color: "var(--fg-2)" }}>
                {totalLessons} lezioni · {sections} sezioni
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-[12px] font-medium"
                style={{ color: "var(--info)", minHeight: "unset", minWidth: "unset" }}
              >
                Chiudi
              </button>
            </div>
            <div onClick={() => setSidebarOpen(false)}>
              {sidebar}
            </div>
          </div>
        )}

        {/* Lesson content — full width */}
        <div>{content}</div>
      </div>

      {/* ── Desktop layout ───────────────────────────────────────── */}
      <div className="hidden md:flex gap-5" style={{ minHeight: 500 }}>
        {/* Sidebar */}
        <div
          className="w-72 shrink-0 rounded-[var(--r-lg)] overflow-hidden"
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "var(--surface)",
            alignSelf: "flex-start",
          }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[12px] font-semibold" style={{ color: "var(--fg-2)" }}>
              {totalLessons} lezioni · {sections} sezioni
            </p>
          </div>
          {sidebar}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">{content}</div>
      </div>
    </>
  );
}
