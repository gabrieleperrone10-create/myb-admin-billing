import "server-only";
import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import { basePrisma } from "@/lib/db";

export type CompanyMemberInfo = {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
};

/**
 * Membri dell'azienda con nome ed email da Clerk: responsabili dei contatti,
 * owner delle opportunita', host dei calendari.
 *
 * CompanyMember non e' in TENANT_MODELS (e' la tabella di membership stessa),
 * quindi si interroga col client base filtrando esplicitamente per companyId.
 * Memoizzata per richiesta: piu' componenti della stessa pagina non
 * moltiplicano le chiamate a Clerk.
 */
export const listCompanyMembers = cache(async (companyId: string): Promise<CompanyMemberInfo[]> => {
  const members = await basePrisma.companyMember.findMany({
    where: { companyId },
    select: { clerkUserId: true },
  });
  if (members.length === 0) return [];

  const client = await clerkClient();
  const { data } = await client.users.getUserList({
    userId: members.map(m => m.clerkUserId),
    limit: 200,
  });
  const byId = new Map(data.map(u => [u.id, u]));

  return members.map(({ clerkUserId }) => {
    const u = byId.get(clerkUserId);
    const email = u?.primaryEmailAddress?.emailAddress ?? u?.emailAddresses[0]?.emailAddress ?? null;
    const name = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email || "Utente" : "Utente";
    return { userId: clerkUserId, name, email, imageUrl: u?.imageUrl ?? null };
  });
});

export function memberName(members: CompanyMemberInfo[], userId: string | null | undefined): string | null {
  if (!userId) return null;
  return members.find(m => m.userId === userId)?.name ?? null;
}
