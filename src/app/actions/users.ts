"use server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { seedDefaultRoles } from "./roles";

export async function listUsers() {
  let userId: string | null = null;
  try { ({ userId } = await auth()); } catch { /* no clerk context */ }
  await seedDefaultRoles(userId ?? undefined);

  const client = await clerkClient();
  const { data: clerkUsers } = await client.users.getUserList({ limit: 200 });

  const allAssignments = await prisma.appUserRole.findMany({
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
}

export async function createNewUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  roleId?: string;
}) {
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
      await prisma.appUserRole.create({
        data: { clerkUserId: user.id, roleId: data.roleId },
      }).catch(() => {});
    }

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: data.email,
      replyTo: process.env.EMAIL_REPLY_TO,
      subject: "Accesso al gestionale – Market Your Business",
      html: `<p>Ciao ${name},</p>
<p>Il tuo account per il gestionale di Market Your Business è stato creato.</p>
<p>Per accedere vai su <a href="https://admin.marketyourbusiness.ai/sign-in">admin.marketyourbusiness.ai/sign-in</a>, clicca su <strong>"Password dimenticata?"</strong> e inserisci la tua email <strong>${data.email}</strong> per impostare la tua password.</p>
<p>Market Your Business</p>`,
    });

    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.errors?.[0]?.longMessage ?? e.message ?? String(e) };
  }
}

export async function assignRole(clerkUserId: string, roleId: string) {
  let userId: string | null = null;
  try { ({ userId } = await auth()); } catch { /* no clerk context */ }
  try {
    await prisma.appUserRole.upsert({
      where: { clerkUserId_roleId: { clerkUserId, roleId } },
      create: { clerkUserId, roleId, assignedBy: userId ?? undefined },
      update: {},
    });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function removeRole(clerkUserId: string, roleId: string) {
  try {
    await prisma.appUserRole.deleteMany({ where: { clerkUserId, roleId } });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function removeUser(clerkUserId: string) {
  const client = await clerkClient();
  try {
    await client.users.deleteUser(clerkUserId);
    await prisma.appUserRole.deleteMany({ where: { clerkUserId } });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
