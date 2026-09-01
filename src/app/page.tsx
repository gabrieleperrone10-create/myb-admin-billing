import { redirect } from "next/navigation";
import { listMyCompanies } from "@/lib/company";

export const dynamic = "force-dynamic";

/**
 * "/" non puo' sapere quale azienda mostrare: e' una decisione che dipende dal
 * DB (a quali aziende appartiene l'utente), quindi vive qui e non in
 * src/proxy.ts — che prima faceva questo redirect in modo statico verso
 * "/dashboard", una rotta che non esiste piu'.
 */
export default async function RootPage() {
  const companies = await listMyCompanies();

  if (companies.length === 0) {
    // L'utente e' autenticato (altrimenti clerkMiddleware l'avrebbe gia'
    // rimandato a /sign-in) ma non e' membro di nessuna azienda. NON si
    // rimanda a /sign-in: per un utente gia' autenticato Clerk lo riporterebbe
    // subito qui via AFTER_SIGN_IN_URL, creando un loop.
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-center px-4" style={{ backgroundColor: "var(--bg)" }}>
        <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Nessuna azienda</p>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Il tuo account non e' ancora collegato a nessuna azienda. Contatta chi amministra il gestionale.
        </p>
      </div>
    );
  }

  redirect(`/${companies[0].slug}/dashboard`);
}
