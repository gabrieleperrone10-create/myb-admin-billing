export const dynamic = "force-dynamic";
import { getCompanySettings } from "@/app/actions/settings";
import SettingsForm from "./SettingsForm";

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
      <SettingsForm settings={settings} />
    </div>
  );
}
