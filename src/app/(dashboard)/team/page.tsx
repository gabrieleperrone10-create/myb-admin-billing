export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { Users2, Tag, Plus, Mail, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { AddTeamMemberModal } from "./AddTeamMemberModal";
import { AddTagModal } from "./AddTagModal";

export default async function TeamPage() {
  const [members, tags] = await Promise.all([
    prisma.teamMember.findMany({
      include: { tags: { include: { tag: true } }, progress: true },
      orderBy: { name: "asc" },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  const active = members.filter(m => m.active);
  const inactive = members.filter(m => !m.active);

  return (
    <div className="space-y-6" style={{ maxWidth: 900 }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Team
          </h1>
          <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
            Gestisci i membri del team, i tag e l&apos;accesso ai corsi.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AddTagModal tags={tags} />
          <AddTeamMemberModal tags={tags} />
        </div>
      </div>

      {/* Tags */}
      <div
        className="p-4 rounded-[8px]"
        style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
          <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Tag disponibili</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>{tags.length}</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Nessun tag. Creane uno per assegnare l&apos;accesso ai corsi.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag.id}
                className="text-[12px] font-mono font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: tag.color + "18", color: tag.color, border: `1px solid ${tag.color}30` }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="space-y-3">
        {members.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-[8px]"
            style={{ border: "1px dashed var(--border)" }}
          >
            <Users2 className="w-8 h-8 mb-3" style={{ color: "var(--fg-3)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Nessun membro</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>Aggiungi il primo membro del team.</p>
          </div>
        ) : (
          <>
            {[{ label: "Attivi", list: active, icon: UserCheck, color: "#3b9e6a" }, { label: "Inattivi", list: inactive, icon: UserX, color: "#9ca3af" }]
              .filter(g => g.list.length > 0)
              .map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <group.icon className="w-3.5 h-3.5" style={{ color: group.color }} />
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider" style={{ color: group.color }}>
                      {group.label} · {group.list.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.list.map(member => (
                      <Link
                        key={member.id}
                        href={`/team/${member.id}`}
                        className="flex items-center gap-4 p-4 rounded-[8px] transition-colors"
                        style={{ backgroundColor: "#fff", border: "1px solid var(--border)" }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-[14px]"
                          style={{ backgroundColor: "oklch(0.92 0.03 260)", color: "var(--fg)" }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{member.name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--fg-3)" }}>
                              <Mail className="w-3 h-3" /> {member.email}
                            </span>
                            {member.role && (
                              <span className="text-[11px]" style={{ color: "var(--fg-3)" }}>· {member.role}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {member.tags.map(({ tag }) => (
                            <span
                              key={tag.id}
                              className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: tag.color + "18", color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          <span className="text-[11px] font-mono" style={{ color: "var(--fg-3)" }}>
                            {member.progress.length} lezioni
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
