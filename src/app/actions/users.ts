"use server";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { seedDefaultRoles } from "@/lib/roleSeed";
import { companyAction } from "@/lib/companyAction";
import { companyDisplayName } from "@/lib/company";

export const listUsers = companyAction(async (ctx) => {
  await seedDefaultRoles(ctx.db, ctx.companyId, ctx.userId);

  const client = await clerkClient();
  const { data: clerkUsers } = await client.users.getUserList({ limit: 200 });

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
    const { randomBytes } = await import("crypto");
    const tempPw = randomBytes(14).toString("hex") + "A1!";

    const user = await client.users.createUser({
      emailAddress: [data.email],
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      password: tempPw,
      skipPasswordChecks: true,
    } as Parameters<typeof client.users.createUser>[0]);

    if (data.roleId) {
      await ctx.db.appUserRole.create({
        data: { companyId: ctx.companyId, clerkUserId: user.id, roleId: data.roleId },
      }).catch(() => {});
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
      html: `<p>Ciao ${name},</p>
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
    await ctx.db.appUserRole.deleteMany({ where: { clerkUserId } });
    const stillMember = await ctx.db.companyMember.findFirst({ where: { clerkUserId } });
    if (!stillMember) {
      await client.users.deleteUser(clerkUserId);
    }
    revalidatePath(`/${ctx.slug}/settings/users`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
});
