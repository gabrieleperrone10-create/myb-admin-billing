"use client";
import { useState } from "react";
import { updateCourse } from "@/app/actions/academy";
import { Eye, EyeOff } from "lucide-react";

export function PublishToggle({ courseId, published }: { courseId: string; published: boolean }) {
  const [isPublished, setIsPublished] = useState(published);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !isPublished;
    setIsPublished(next);
    await updateCourse(courseId, { published: next });
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors"
      style={{
        border: "1px solid var(--border)",
        backgroundColor: isPublished ? "#3b9e6a18" : "#fff",
        color: isPublished ? "#3b9e6a" : "var(--fg-2)",
      }}
    >
      {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      {isPublished ? "Pubblicato" : "Bozza"}
    </button>
  );
}
