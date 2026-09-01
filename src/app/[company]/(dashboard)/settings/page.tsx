export const dynamic = "force-dynamic";
import Link from "next/link";
import { getCompanySettings } from "@/app/actions/settings";
import SettingsForm from "./SettingsForm";
import { UserCog, Shield, PartyPopper, Zap } from "lucide-react";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { company: slug } = await params;
  const { onboarding } = await searchParams;
  const settings = await getCompanySettings(slug);

  return (
    <div className="max-w-[900px]">
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>
          Impostazioni
        </h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          Dati aziendali che appaiono su fatture ed email ai clienti
        </p>
      </div>

      {onboarding && (
        <div
          className="mb-8 p-5 rounded-[var(--r-lg)]"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <PartyPopper className="w-5 h-5" style={{ color: "#4f7deb" }} />
            <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              Azienda creata — ecco cosa serve per andare avanti
            </p>
          </div>
          <ol className="space-y-2.5 text-[13px]" style={{ color: "var(--fg-2)" }}>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">1.</span>
              <span>
                Compila <strong>dati fiscali, indirizzo e coordinate bancarie</strong> qui sotto:
                compaiono su fatture, note di credito e nelle email ai clienti.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">2.</span>
              <span>
                Invita chi deve avere accesso da{" "}
                <Link href={`/${slug}/settings/users`} className="underline font-medium">Utenti & Accessi</Link>
                {" "}e assegna i ruoli da{" "}
                <Link href={`/${slug}/settings/roles`} className="underline font-medium">Ruoli & Permessi</Link>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">3.</span>
              <span>
                Attiva le automazioni email (promemoria scadenze, benvenuto contratto, ecc.) da{" "}
                <Link href={`/${slug}/automations`} className="underline font-medium">Automazioni</Link>
                {" "}— sono create disattivate di default.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold shrink-0">4.</span>
              <span>
                Se il dominio del mittente email è nuovo, verificalo su Resend prima di attivare
                le automazioni, altrimenti gli invii falliscono silenziosamente.
              </span>
            </li>
          </ol>
          <p className="flex items-center gap-1.5 mt-3 text-[12px]" style={{ color: "var(--fg-3)" }}>
            <Zap className="w-3.5 h-3.5 shrink-0" />
            Stripe e PayPal non sono ancora collegabili da qui — per ora si registrano solo come metodo di pagamento sui movimenti.
          </p>
        </div>
      )}

      {/* Access management shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Link
          href={`/${slug}/settings/users`}
          className="flex items-center gap-3 p-4 rounded-[var(--r-lg)] transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#4f7deb18" }}>
            <UserCog className="w-5 h-5" style={{ color: "#4f7deb" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>Utenti & Accessi</p>
            <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Invita utenti e assegna ruoli</p>
          </div>
        </Link>
        <Link
          href={`/${slug}/settings/roles`}
          className="flex items-center gap-3 p-4 rounded-[var(--r-lg)] transition-colors"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "#8b5cf618" }}>
            <Shield className="w-5 h-5" style={{ color: "#8b5cf6" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>Ruoli & Permessi</p>
            <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Configura accesso granulare</p>
          </div>
        </Link>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
