export const dynamic = "force-dynamic";
import Link from "next/link";
import { getCompanySettings } from "@/app/actions/settings";
import SettingsForm from "./SettingsForm";
import { UserCog, Shield } from "lucide-react";

export default async function SettingsPage() {
  const settings = await getCompanySettings();

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

      {/* Access management shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <Link
          href="/settings/users"
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
          href="/settings/roles"
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
