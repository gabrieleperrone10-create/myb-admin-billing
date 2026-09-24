"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { canEdit, getEffectivePermissions } from "@/lib/permissions";
import { dayToStored, parseAmount, parseDay, parseSpendCsv, CSV_MAX_ROWS } from "@/lib/crm/reports/spend";
import { normalizeSource } from "@/lib/crm/reports/sources";

/**
 * Spesa pubblicitaria (AdSpend). Unico punto di scrittura: le date si salvano
 * come date di calendario a mezzanotte UTC, estremi inclusi (vedi
 * lib/crm/reports/spend.ts), la fonte gia' normalizzata (facebook/ig -> meta).
 */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function assertCanEdit(ctx: CompanyContext) {
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);
  if (!canEdit(perms, "REPORTS")) throw new Error("Permessi insufficienti per modificare la spesa pubblicitaria");
}

const MAX_AMOUNT = 10_000_000;

const spendInput = z.object({
  source: z.string().trim().min(1, "La fonte è obbligatoria").max(100),
  campaign: z.string().trim().max(200).optional().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amount: z.union([z.string(), z.number()]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type AdSpendInput = z.input<typeof spendInput>;

function validate(input: unknown): Result<{
  source: string; campaign: string | null; periodStart: Date; periodEnd: Date; amount: number; notes: string | null;
}> {
  const parsed = spendInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const v = parsed.data;
  const source = normalizeSource(v.source);
  if (!source) return { ok: false, error: "La fonte è obbligatoria" };
  const start = parseDay(v.periodStart);
  const end = parseDay(v.periodEnd);
  if (!start || !end) return { ok: false, error: "Date del periodo non valide" };
  if (end < start) return { ok: false, error: "La data di fine è precedente alla data di inizio" };
  const amount = parseAmount(v.amount);
  if (amount === null || amount > MAX_AMOUNT) return { ok: false, error: "Importo non valido" };
  return {
    ok: true,
    data: {
      source,
      campaign: v.campaign ? v.campaign : null,
      periodStart: dayToStored(start),
      periodEnd: dayToStored(end),
      amount: Math.round(amount * 100) / 100,
      notes: v.notes ? v.notes : null,
    },
  };
}

function revalidate(slug: string) {
  revalidatePath(`/${slug}/reports`);
  revalidatePath(`/${slug}/reports/spend`);
}

export const createAdSpend = companyAction(async (ctx, input: AdSpendInput): Promise<Result<{ id: string }>> => {
  await assertCanEdit(ctx);
  const v = validate(input);
  if (!v.ok) return v;
  const row = await ctx.db.adSpend.create({
    data: { ...v.data, companyId: ctx.companyId, createdByUserId: ctx.userId },
    select: { id: true },
  });
  revalidate(ctx.slug);
  return { ok: true, data: { id: row.id } };
});

export const updateAdSpend = companyAction(async (ctx, id: string, input: AdSpendInput): Promise<Result> => {
  await assertCanEdit(ctx);
  if (typeof id !== "string" || !id) return { ok: false, error: "Voce non trovata" };
  const v = validate(input);
  if (!v.ok) return v;
  const existing = await ctx.db.adSpend.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Voce non trovata" };
  await ctx.db.adSpend.update({ where: { id }, data: v.data });
  revalidate(ctx.slug);
  return { ok: true, data: undefined };
});

export const deleteAdSpend = companyAction(async (ctx, id: string): Promise<Result> => {
  await assertCanEdit(ctx);
  if (typeof id !== "string" || !id) return { ok: false, error: "Voce non trovata" };
  // deleteMany: filtrato per azienda dall'estensione, 0 righe se l'id e' di un'altra azienda
  const { count } = await ctx.db.adSpend.deleteMany({ where: { id } });
  if (count === 0) return { ok: false, error: "Voce non trovata" };
  revalidate(ctx.slug);
  return { ok: true, data: undefined };
});

export type ImportSpendResult =
  | { ok: true; imported: number; errors: { line: number; message: string }[] }
  | { ok: false; error: string; errors: { line: number; message: string }[]; validRows: number };

/**
 * Import CSV. Se ci sono righe con errori non importa nulla, a meno che
 * `skipInvalid` sia true (l'utente ha confermato di importare le sole righe valide).
 */
export const importAdSpendCsv = companyAction(async (ctx, text: string, skipInvalid: boolean): Promise<ImportSpendResult> => {
  await assertCanEdit(ctx);
  if (typeof text !== "string" || text.length > 2_000_000) {
    return { ok: false, error: "File non valido o troppo grande (max 2 MB)", errors: [], validRows: 0 };
  }
  const parsed = parseSpendCsv(text);
  const tooBig = parsed.rows.find(r => r.amount > MAX_AMOUNT);
  if (tooBig) parsed.errors.push({ line: tooBig.line, message: "importo fuori scala" });
  const rows = parsed.rows.filter(r => r.amount <= MAX_AMOUNT);

  if (rows.length === 0) {
    return { ok: false, error: "Nessuna riga valida da importare", errors: parsed.errors, validRows: 0 };
  }
  if (parsed.errors.length > 0 && !skipInvalid) {
    return { ok: false, error: `${parsed.errors.length} righe con errori`, errors: parsed.errors, validRows: rows.length };
  }
  if (rows.length > CSV_MAX_ROWS) {
    return { ok: false, error: `Massimo ${CSV_MAX_ROWS} righe per import`, errors: [], validRows: rows.length };
  }

  await ctx.db.adSpend.createMany({
    data: rows.map(r => ({
      companyId: ctx.companyId,
      source: r.source,
      campaign: r.campaign,
      periodStart: dayToStored(r.periodStart),
      periodEnd: dayToStored(r.periodEnd),
      amount: Math.round(r.amount * 100) / 100,
      notes: "Import CSV",
      createdByUserId: ctx.userId,
    })),
  });
  revalidate(ctx.slug);
  return { ok: true, imported: rows.length, errors: parsed.errors };
});
