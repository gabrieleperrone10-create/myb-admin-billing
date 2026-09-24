"use server";

import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { basePrisma } from "@/lib/db";
import { canEdit, getUserPermissions } from "@/lib/permissions";
import { normalizeDomain } from "@/lib/email/identity";
import { refreshCompanyEmailDomain, removeCompanyEmailDomain, setupCompanyEmailDomain } from "@/lib/email/domains";

type Result = { ok: true } | { ok: false; error: string };

async function assertCanEditSettings(ctx: CompanyContext) {
  const perms = await getUserPermissions(ctx.db, ctx.companyId, ctx.userId);
  if (!canEdit(perms, "SETTINGS")) throw new Error("Permessi insufficienti per modificare le impostazioni");
}

const path = (slug: string) => `/${slug}/settings/email`;

export const connectEmailDomain = companyAction(async (ctx, rawDomain: string, withReceiving: boolean): Promise<Result> => {
  await assertCanEditSettings(ctx);
  const domain = normalizeDomain(rawDomain);
  if (!domain) return { ok: false, error: "Dominio non valido (es. tuodominio.it)" };
  if (ctx.company.emailDomain) return { ok: false, error: "C'è già un dominio collegato: scollegalo prima" };
  try {
    await setupCompanyEmailDomain(ctx.companyId, domain, withReceiving);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore nel collegamento del dominio" };
  }
  revalidatePath(path(ctx.slug));
  return { ok: true };
});

export const verifyEmailDomain = companyAction(async (ctx): Promise<Result> => {
  await assertCanEditSettings(ctx);
  const c = await refreshCompanyEmailDomain(ctx.companyId, { triggerVerify: true });
  revalidatePath(path(ctx.slug));
  const err = (c.emailDomainMeta as { lastError?: string | null } | null)?.lastError;
  return err ? { ok: false, error: err } : { ok: true };
});

export const disconnectEmailDomain = companyAction(async (ctx): Promise<Result> => {
  await assertCanEditSettings(ctx);
  const errors = await removeCompanyEmailDomain(ctx.companyId);
  revalidatePath(path(ctx.slug));
  return errors.length ? { ok: false, error: `Scollegato, ma Resend ha segnalato: ${errors.join("; ")}` } : { ok: true };
});

/** Parte locale del mittente (es. "info" → info@dominio). */
export const setSenderLocalPart = companyAction(async (ctx, local: string, fromName: string): Promise<Result> => {
  await assertCanEditSettings(ctx);
  const domain = ctx.company.emailDomain;
  if (!domain) return { ok: false, error: "Collega prima un dominio" };
  const l = local.trim().toLowerCase();
  if (!/^[a-z0-9._+-]{1,64}$/.test(l)) return { ok: false, error: "Indirizzo non valido (es. info, vendite)" };
  const name = fromName.trim().slice(0, 100);
  // Company e' il tenant: aggiornamento per id dopo requireCompany().
  await basePrisma.company.update({
    where: { id: ctx.companyId },
    data: { emailFromAddress: `${l}@${domain}`, ...(name ? { emailFromName: name } : {}) },
  });
  revalidatePath(path(ctx.slug));
  return { ok: true };
});
