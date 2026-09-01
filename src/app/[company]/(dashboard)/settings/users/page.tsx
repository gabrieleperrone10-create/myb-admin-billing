export const dynamic = "force-dynamic";
import { listUsers } from "@/app/actions/users";
import { getRoles } from "@/app/actions/roles";
import UsersClient from "./UsersClient";

export default async function UsersPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const [users, roles] = await Promise.all([listUsers(slug), getRoles(slug)]);

  return (
    <div className="max-w-[900px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
          Utenti & Accessi
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>
          Gestisci chi può accedere al gestionale e con quali permessi
        </p>
      </div>
      <UsersClient
        users={users}
        roles={roles.map(r => ({ id: r.id, name: r.name, color: r.color }))}
        slug={slug}
      />
    </div>
  );
}
