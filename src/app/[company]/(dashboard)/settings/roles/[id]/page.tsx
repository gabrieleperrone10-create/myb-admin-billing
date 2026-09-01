export const dynamic = "force-dynamic";
import { getRoleById } from "@/app/actions/roles";
import { notFound } from "next/navigation";
import RoleEditorClient from "./RoleEditorClient";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function RoleEditorPage({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;
  const role = await getRoleById(slug, id);
  if (!role) notFound();

  return (
    <div className="max-w-[860px]">
      <Link
        href={`/${slug}/settings/roles`}
        className="inline-flex items-center gap-1 text-[13px] mb-5"
        style={{ color: "var(--fg-3)", minHeight: "unset" }}
      >
        <ChevronLeft className="w-4 h-4" />
        Torna ai ruoli
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
          <h1 className="text-[24px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
            {role.name}
          </h1>
          {role.isSystem && (
            <span
              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)", border: "1px solid var(--border)" }}
            >
              sistema
            </span>
          )}
        </div>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Configura nome, descrizione e permessi granulari per ogni sezione
        </p>
      </div>

      <RoleEditorClient role={role} slug={slug} />
    </div>
  );
}
