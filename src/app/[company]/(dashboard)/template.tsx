import { headers } from "next/headers";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { getUserAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { firstAllowedPath, sectionForPath } from "@/lib/sections";
import { companyPath } from "@/lib/paths";

/**
 * Controllo di accesso per sezione, lato server, a ogni navigazione.
 *
 * Prima i permessi "Nessuno" nascondevano solo la voce di menu: l'URL diretto
 * apriva comunque la pagina. Qui, se il ruolo non concede la sezione, al posto
 * della pagina si mostra un avviso. Stessa regola di getUserAccess: chi non ha
 * alcun ruolo nell'azienda ha accesso pieno (come nel menu).
 * La visibilita' dei singoli record ("Solo assegnati") e' invece nel client db.
 */
export default async function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-app-pathname") ?? "";
  const [, slug, ...rest] = path.split("/");
  if (!slug) return children;
  const section = sectionForPath("/" + rest.join("/"));
  if (!section) return children;

  const ctx = await requireCompany(slug);
  const { perms } = await getUserAccess(ctx.db, ctx.companyId, ctx.userId);
  if (perms[section] !== "NONE") return children;

  // Dopo il login si arriva sempre su /dashboard: se il ruolo non la include
  // si va alla prima sezione consentita invece di mostrare "non hai accesso".
  const landing = firstAllowedPath(perms);
  if (section === "DASHBOARD" && landing) redirect(companyPath(slug, landing));

  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <ShieldOff className="w-9 h-9 mx-auto mb-4" style={{ color: "var(--fg-3)" }} strokeWidth={1.4} />
      <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Non hai accesso a questa sezione</p>
      <p className="text-[13px] mt-1" style={{ color: "var(--fg-3)" }}>
        {landing
          ? "Il tuo ruolo non la include. Chiedi a un amministratore di modificarlo in Impostazioni › Ruoli."
          : "Il tuo ruolo non concede ancora nessuna sezione: chiedi a un amministratore di impostarne i permessi in Impostazioni › Ruoli."}
      </p>
      {landing && (
        <Link href={companyPath(slug, landing)} className="inline-block mt-5 text-[13px] underline" style={{ color: "var(--fg-2)" }}>
          Vai a una sezione disponibile
        </Link>
      )}
    </div>
  );
}
