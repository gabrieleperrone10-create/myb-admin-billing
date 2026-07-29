export const dynamic = "force-dynamic";
import { getRoles } from "@/app/actions/roles";
import RolesClient from "./RolesClient";

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <div className="max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
          Ruoli & Permessi
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>
          Definisci i livelli di accesso per ogni sezione del gestionale
        </p>
      </div>
      <RolesClient roles={roles} />
    </div>
  );
}
