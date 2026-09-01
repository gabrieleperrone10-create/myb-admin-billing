export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { SopEditorPage } from "./SopEditorPage";
import { SopAiChat } from "@/components/SopAiChat";

export default async function SopDetailPage({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;
  const { db } = await requireCompany(slug);

  const [sop, folders, tags] = await Promise.all([
    db.sop.findUnique({
      where: { id },
      include: { folder: true, tags: { include: { tag: true } }, attachments: true },
    }),
    db.sopFolder.findMany({ orderBy: { order: "asc" } }),
    db.sopTag.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!sop) notFound();

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="flex items-center gap-2 mb-4">
        <Link href={`/${slug}/sop`} className="flex items-center gap-1 text-[13px] hover:opacity-70" style={{ color: "var(--fg-3)" }}>
          <ChevronLeft className="w-3.5 h-3.5" /> SOP
        </Link>
        <span style={{ color: "var(--fg-3)" }}>/</span>
        {sop.folder && (
          <>
            <Link href={`/${slug}/sop?folder=${sop.folder.id}`} className="text-[13px] hover:opacity-70" style={{ color: sop.folder.color }}>
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
