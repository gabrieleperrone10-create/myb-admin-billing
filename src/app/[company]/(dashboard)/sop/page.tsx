export const dynamic = "force-dynamic";
import { requireCompany } from "@/lib/company";
import { FileText, FolderOpen, Search, Tag, Plus } from "lucide-react";
import Link from "next/link";
import { SopAiChat } from "@/components/SopAiChat";
import { CreateFolderModal } from "./CreateFolderModal";
import { CreateSopModal } from "./CreateSopModal";
import { DeleteSopButton } from "./DeleteSopButton";
import type { CompanyDb } from "@/lib/db";

export default async function SopPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ folder?: string; tag?: string; q?: string }>;
}) {
  const [{ company: slug }, { folder: folderId, tag: tagId, q }] = await Promise.all([params, searchParams]);
  const { db } = await requireCompany(slug);

  const [folders, tags, sops] = await Promise.all([
    db.sopFolder.findMany({ orderBy: { order: "asc" } }),
    db.sopTag.findMany({ orderBy: { name: "asc" } }),
    db.sop.findMany({
      where: {
        ...(folderId ? { folderId } : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { folder: true, tags: { include: { tag: true } }, attachments: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Mobile layout ──────────────────────────────────────────── */}
      <div className="md:hidden space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-bold" style={{ letterSpacing: "-0.02em", color: "var(--fg)" }}>SOP</h1>
          <CreateSopModal folders={folders} tags={tags} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--fg-3)" }} />
          <form method="GET">
            {folderId && <input type="hidden" name="folder" value={folderId} />}
            {tagId && <input type="hidden" name="tag" value={tagId} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Cerca SOP..."
              className="w-full pl-10 pr-4 py-2.5 rounded-[var(--r-lg)] outline-none"
              style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "var(--surface)" }}
            />
          </form>
        </div>

        {/* Horizontal filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <Link
            href={`/${slug}/sop`}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap shrink-0 transition-colors"
            style={{
              backgroundColor: !folderId && !tagId ? "var(--fg)" : "var(--surface)",
              color: !folderId && !tagId ? "var(--surface)" : "var(--fg-2)",
              borderColor: !folderId && !tagId ? "var(--fg)" : "var(--border)",
              minHeight: "unset",
            }}
          >
            Tutte · {sops.length}
          </Link>
          {folders.map(folder => (
            <Link
              key={folder.id}
              href={`/${slug}/sop?folder=${folder.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap shrink-0 transition-colors"
              style={{
                backgroundColor: folderId === folder.id ? folder.color : "var(--surface)",
                color: folderId === folder.id ? "#fff" : "var(--fg-2)",
                borderColor: folderId === folder.id ? folder.color : "var(--border)",
                minHeight: "unset",
              }}
            >
              <FolderOpen className="w-3 h-3 shrink-0" />
              {folder.name}
            </Link>
          ))}
          {tags.map(tag => (
            <Link
              key={tag.id}
              href={tagId === tag.id ? `/${slug}/sop` : `/${slug}/sop?tag=${tag.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap shrink-0 transition-colors"
              style={{
                backgroundColor: tagId === tag.id ? tag.color : "var(--surface)",
                color: tagId === tag.id ? "#fff" : tag.color,
                borderColor: tagId === tag.id ? tag.color : tag.color + "40",
                minHeight: "unset",
              }}
            >
              <Tag className="w-3 h-3 shrink-0" />
              {tag.name}
            </Link>
          ))}
        </div>

        {/* SOP list */}
        <SopList sops={sops} q={q} folders={folders} tags={tags} slug={slug} mobile />
      </div>

      {/* ── Desktop layout ─────────────────────────────────────────── */}
      <div className="hidden md:flex gap-5">

        {/* Left sidebar */}
        <div className="w-52 shrink-0 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: "var(--fg-3)" }}>
                Cartelle
              </span>
              <CreateFolderModal />
            </div>
            <div className="space-y-0.5">
              <Link
                href={`/${slug}/sop`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--r-md)] text-[13px] transition-colors"
                style={{
                  backgroundColor: !folderId && !tagId ? "var(--subtle)" : "transparent",
                  color: !folderId && !tagId ? "var(--fg)" : "var(--fg-2)",
                  fontWeight: !folderId && !tagId ? 600 : 400,
                  minHeight: "unset",
                }}
              >
                <FileText className="w-3.5 h-3.5" /> Tutte le SOP
                <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--fg-3)" }}>{sops.length}</span>
              </Link>
              {folders.map(folder => (
                <Link
                  key={folder.id}
                  href={`/${slug}/sop?folder=${folder.id}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--r-md)] text-[13px] transition-colors"
                  style={{
                    backgroundColor: folderId === folder.id ? folder.color + "15" : "transparent",
                    color: folderId === folder.id ? folder.color : "var(--fg-2)",
                    fontWeight: folderId === folder.id ? 600 : 400,
                    minHeight: "unset",
                  }}
                >
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: folder.color }} />
                  <span className="truncate">{folder.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--fg-3)" }}>
                Tag
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <Link
                    key={tag.id}
                    href={tagId === tag.id ? `/${slug}/sop` : `/${slug}/sop?tag=${tag.id}`}
                    className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full badge"
                    style={{
                      backgroundColor: tagId === tag.id ? tag.color : tag.color + "18",
                      color: tagId === tag.id ? "#fff" : tag.color,
                      border: `1px solid ${tag.color}30`,
                      minHeight: "unset",
                    }}
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
              <form method="GET">
                {folderId && <input type="hidden" name="folder" value={folderId} />}
                {tagId && <input type="hidden" name="tag" value={tagId} />}
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Cerca SOP..."
                  className="w-full pl-9 pr-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
                  style={{ border: "1px solid var(--border)", color: "var(--fg)", backgroundColor: "var(--surface)" }}
                />
              </form>
            </div>
            <CreateSopModal folders={folders} tags={tags} />
          </div>
          <SopList sops={sops} q={q} folders={folders} tags={tags} slug={slug} />
        </div>
      </div>

      <SopAiChat />
    </div>
  );
}

// ── Shared SOP list component ───────────────────────────────────────────────

type SopItem = Awaited<ReturnType<CompanyDb["sop"]["findMany"]>>[number] & {
  folder: { id: string; name: string; color: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  attachments: { id: string }[];
};

function SopList({
  sops,
  q,
  folders,
  tags,
  slug,
  mobile = false,
}: {
  sops: SopItem[];
  q?: string;
  folders: { id: string; name: string; color: string }[];
  tags: { id: string; name: string; color: string }[];
  slug: string;
  mobile?: boolean;
}) {
  if (sops.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 rounded-[var(--r-lg)]"
        style={{ border: "1px dashed var(--border)" }}
      >
        <FileText className="w-10 h-10 mb-3" style={{ color: "var(--fg-3)" }} />
        <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Nessuna SOP</p>
        <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>Crea la prima procedura operativa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sops.map(sop => (
        <div
          key={sop.id}
          className="flex items-start gap-3 px-4 py-3 rounded-[var(--r-lg)] group"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-9 h-9 rounded-[var(--r-md)] flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: sop.folder ? sop.folder.color + "15" : "var(--subtle)" }}
          >
            <FileText className="w-4 h-4" style={{ color: sop.folder?.color ?? "var(--fg-3)" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <Link
                href={`/${slug}/sop/${sop.id}`}
                className="text-[14px] font-semibold hover:underline"
                style={{ color: "var(--fg)", minHeight: "unset", lineHeight: 1.3 }}
              >
                {sop.title}
              </Link>
              {!sop.published && (
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase badge" style={{ backgroundColor: "#f9741618", color: "#c2590a" }}>
                  bozza
                </span>
              )}
              {sop.tags.map(({ tag }) => (
                <span key={tag.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded-full badge" style={{ backgroundColor: tag.color + "18", color: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]" style={{ color: "var(--fg-3)" }}>
              {sop.folder && <span>{sop.folder.name}</span>}
              {sop.roles.length > 0 && <span>· {sop.roles.join(", ")}</span>}
              {sop.attachments.length > 0 && <span>· {sop.attachments.length} allegati</span>}
              <span>· {new Date(sop.updatedAt).toLocaleDateString("it-IT")}</span>
            </div>

            {/* Mobile: always-visible actions */}
            {mobile && (
              <div className="flex items-center gap-2 mt-2">
                <Link
                  href={`/${slug}/sop/${sop.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
                >
                  <Plus className="w-3 h-3" strokeWidth={2} /> Apri
                </Link>
                <DeleteSopButton sopId={sop.id} sopTitle={sop.title} />
              </div>
            )}
          </div>

          {/* Desktop: hover actions */}
          {!mobile && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Link
                href={`/${slug}/sop/${sop.id}`}
                className="px-2.5 py-1 rounded-[var(--r-md)] text-[12px] font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
              >
                Apri
              </Link>
              <DeleteSopButton sopId={sop.id} sopTitle={sop.title} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
