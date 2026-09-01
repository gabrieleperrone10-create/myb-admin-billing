export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { SopEditorPage } from "./SopEditorPage";
import { SopAiChat } from "@/components/SopAiChat";

export default async function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [sop, folders, tags] = await Promise.all([
    prisma.sop.findUnique({
      where: { id },
      include: { folder: true, tags: { include: { tag: true } }, attachments: true },
    }),
    prisma.sopFolder.findMany({ orderBy: { order: "asc" } }),
    prisma.sopTag.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!sop) notFound();

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="flex items-center gap-2 mb-4">
        <Link href="/sop" className="flex items-center gap-1 text-[13px] hover:opacity-70" style={{ color: "var(--fg-3)" }}>
          <ChevronLeft className="w-3.5 h-3.5" /> SOP
        </Link>
        <span style={{ color: "var(--fg-3)" }}>/</span>
        {sop.folder && (
          <>
            <Link href={`/sop?folder=${sop.folder.id}`} className="text-[13px] hover:opacity-70" style={{ color: sop.folder.color }}>
              {sop.folder.name}
            </Link>
            <span style={{ color: "var(--fg-3)" }}>/</span>
          </>
        )}
        <span className="text-[13px]" style={{ color: "var(--fg-2)" }}>{sop.title}</span>
      </div>

      <SopEditorPage sop={sop as any} folders={folders} allTags={tags} />
      <SopAiChat />
    </div>
  );
}
