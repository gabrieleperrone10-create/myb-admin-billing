"use server";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { seedDefaultRoles } from "@/lib/roleSeed";
import { companyAction } from "@/lib/companyAction";
import { companyDisplayName } from "@/lib/company";
import { basePrisma } from "@/lib/db";

/**
 * CompanyMember e' cio' che dà accesso a un'azienda (requireCompany). Non e' un
 * modello tenant: si interroga col client base filtrando SEMPRE per companyId.
 */
async function ensureMember(companyId: string, clerkUserId: string) {
  await basePrisma.companyMember.upsert({
    where: { companyId_clerkUserId: { companyId, clerkUserId } },
    create: { companyId, clerkUserId },
    update: {},
  });
}

export const listUsers = companyAction(async (ctx) => {
  await seedDefaultRoles(ctx.db, ctx.companyId, ctx.userId);

  // Solo i membri di QUESTA azienda: prima l'elenco mostrava tutti gli account
  // del sistema, anche quelli di altre aziende.
  const members = await basePrisma.companyMember.findMany({
    where: { companyId: ctx.companyId },
    select: { clerkUserId: true },
  });
  if (members.length === 0) return [];
  const client = await clerkClient();
  const { data: clerkUsers } = await client.users.getUserList({ userId: members.map(m => m.clerkUserId), limit: 200 });

  // Solo le assegnazioni di QUESTA azienda: i ruoli in un'altra azienda non
  // devono comparire qui, ne' dare accesso qui.
  const allAssignments = await ctx.db.appUserRole.findMany({
    include: { role: true },
  });

  return clerkUsers.map(u => ({
    id: u.id,
    email: u.emailAddresses[0]?.emailAddress ?? "",
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Utente",
    imageUrl: u.imageUrl,
    createdAt: new Date(u.createdAt),
    roles: allAssignments
      .filter(a => a.clerkUserId === u.id)
      .map(a => ({ id: a.role.id, name: a.role.name, color: a.role.color })),
  }));
});

export const createNewUser = companyAction(async (ctx, data: {
  email: string;
  firstName: string;
  lastName: string;
  roleId?: string;
}) => {
  const client = await clerkClient();
  try {
    const email = data.email.trim().toLowerCase();
    // Stessa email = stesso account: se esiste gia' (es. chi entra con Google
    // o e' membro di un'altra azienda) lo si aggiunge a questa azienda invece
    // di crearne un secondo, che non avrebbe accesso ai dati del primo.
    const { data: found } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const existing = found[0] ?? null;
    let user = existing;
    if (!user) {
      const { randomBytes } = await import("crypto");
      const tempPw = randomBytes(14).toString("hex") + "A1!";
      user = await client.users.createUser({
        emailAddress: [email],
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        password: tempPw,
        skipPasswordChecks: true,
      } as Parameters<typeof client.users.createUser>[0]);
    }

    // Senza membership l'utente entrava ma vedeva "nessuna azienda".
    await ensureMember(ctx.companyId, user.id);

    if (data.roleId) {
      const role = await ctx.db.appRole.findUnique({ where: { id: data.roleId }, select: { id: true } });
      if (role) {
        await ctx.db.appUserRole.upsert({
          where: { companyId_clerkUserId_roleId: { companyId: ctx.companyId, clerkUserId: user.id, roleId: role.id } },
          create: { companyId: ctx.companyId, clerkUserId: user.id, roleId: role.id, assignedBy: ctx.userId },
          update: {},
        });
      }
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;
    const fromEmail = ctx.company.emailFromAddress ?? process.env.EMAIL_FROM!;
    const replyTo   = ctx.company.emailReplyTo ?? process.env.EMAIL_REPLY_TO;
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const brand     = companyDisplayName(ctx.company);
    await resend.emails.send({
      from: fromEmail,
      to: data.email,
      replyTo,
      subject: `Accesso al gestionale – ${brand}`,
      html: existing
        ? `<p>Ciao ${name},</p>
<p>Sei stato aggiunto al gestionale di ${brand}.</p>
<p>Accedi da <a href="${appUrl}/sign-in">${appUrl.replace(/^https?:\/\//, "")}/sign-in</a> con il tuo account di sempre (${email}).</p>
<p>${brand}</p>`
        : `<p>Ciao ${name},</p>
<p>Il tuo account per il gestionale di ${brand} è stato creato.</p>
<p>Per accedere vai su <a href="${appUrl}/sign-in">${appUrl.replace(/^https?:\/\//, "")}/sign-in</a>, clicca su <strong>"Password dimenticata?"</strong> e inserisci la tua email <strong>${data.email}</strong> per impostare la tua password.</p>
<p>${brand}</p>`,
    });

    revalidatePath(`/${ctx.slug}/settings/users`);
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { errors?: { longMessage?: string }[]; message?: string };
    return { ok: false, error: err.errors?.[0]?.longMessage ?? err.message ?? String(e) };
  }
});

export const assignRole = companyAction(async (ctx, clerkUserId: string, roleId: string) => {
  const [role, member] = await Promise.all([
    ctx.db.appRole.findUnique({ where: { id: roleId }, select: { id: true } }),
    basePrisma.companyMember.findUnique({ where: { companyId_clerkUserId: { companyId: ctx.companyId, clerkUserId } } }),
  ]);
  if (!role) return { ok: false, error: "Ruolo non trovato" };
  if (!member) return { ok: false, error: "L'utente non fa parte di questa azienda" };
  try {
    await ctx.db.appUserRole.upsert({
      where: { companyId_clerkUserId_roleId: { companyId: ctx.companyId, clerkUserId, roleId } },
      create: { companyId: ctx.companyId, clerkUserId, roleId, assignedBy: ctx.userId },
      update: {},
    });
    revalidatePath(`/${ctx.slug}/settings/users`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

export const removeRole = companyAction(async (ctx, clerkUserId: string, roleId: string) => {
  try {
    await ctx.db.appUserRole.deleteMany({ where: { clerkUserId, roleId } });
    revalidatePath(`/${ctx.slug}/settings/users`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});

export const removeUser = companyAction(async (ctx, clerkUserId: string) => {
  const client = await clerkClient();
  try {
    // Rimuove solo la membership/i ruoli di QUESTA azienda: l'utente puo'
    // appartenere anche ad altre aziende. L'account Clerk va cancellato solo se
    // non e' membro di nessun'altra.
    if (clerkUserId === ctx.userId) return { ok: false, error: "Non puoi rimuovere te stesso" };
    await ctx.db.appUserRole.deleteMany({ where: { clerkUserId } });
    await basePrisma.companyMember.deleteMany({ where: { companyId: ctx.companyId, clerkUserId } });
    // Prima la ricerca non era filtrata per azienda e trovava sempre la
    // membership appena "rimossa": l'accesso restava.
    const stillMember = await basePrisma.companyMember.findFirst({ where: { clerkUserId } });
    if (!stillMember) {
      await client.users.deleteUser(clerkUserId);
    }
    revalidatePath(`/${ctx.slug}/settings/users`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
