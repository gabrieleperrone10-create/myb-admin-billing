"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { companyAction } from "@/lib/companyAction";
import type { CompanyContext } from "@/lib/company";
import { basePrisma } from "@/lib/db";
import { decryptJson, encryptJson, isEncryptionConfigured } from "@/lib/crypto";
import { canEdit, getUserPermissions } from "@/lib/permissions";
import {
  fetchPhoneNumberInfo,
  subscribeAppToWaba,
  integrationToConfig,
  type WhatsAppMeta,
  type WhatsAppSecrets,
} from "@/lib/crm/messaging/whatsapp";

/**
 * Impostazioni WhatsApp Cloud API per azienda.
 *
 * File "use server" = endpoint POST pubblici: ogni action passa da
 * companyAction (membership) e in piu' richiede il permesso EDIT su
 * Impostazioni. Il resto dell'app applica i permessi solo alla sidebar; qui
 * si maneggiano credenziali, quindi il controllo e' lato server.
 *
 * I segreti (access token, app secret) entrano ma non escono MAI: le action
 * restituiscono solo WhatsAppStatus (ultime 4 cifre del token, flag).
 *
 * CompanyIntegration non e' in TENANT_MODELS: ogni query filtra
 * esplicitamente per ctx.companyId (upsert sulla chiave composta).
 */

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function assertCanEditSettings(ctx: CompanyContext) {
  const perms = await getUserPermissions(ctx.db, ctx.companyId, ctx.userId);
  if (!canEdit(perms, "SETTINGS")) throw new Error("Permessi insufficienti per modificare le impostazioni");
}

const SaveSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone Number ID non valido (solo cifre)"),
  wabaId: z.string().trim().regex(/^\d{5,30}$/, "WhatsApp Business Account ID non valido (solo cifre)"),
  displayPhone: z.string().trim().max(40).optional().default(""),
  // vuoti = mantieni quelli gia' salvati
  accessToken: z.string().trim().max(2000).optional().default(""),
  appSecret: z.string().trim().max(200).optional().default(""),
  active: z.boolean(),
});

export type SaveWhatsAppInput = z.input<typeof SaveSchema>;

export const saveWhatsAppSettings = companyAction(async (ctx, input: SaveWhatsAppInput): Promise<Result> => {
  await assertCanEditSettings(ctx);
  if (!isEncryptionConfigured()) return { ok: false, error: "TOKEN_ENCRYPTION_KEY non configurata sul server: impossibile salvare i segreti" };

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const v = parsed.data;

  const key = { companyId_provider: { companyId: ctx.companyId, provider: "WHATSAPP" as const } };
  const existing = await ctx.db.companyIntegration.findUnique({ where: key });

  let secrets: WhatsAppSecrets = { accessToken: "", appSecret: "" };
  if (existing?.secretCipher) {
    try {
      secrets = decryptJson<WhatsAppSecrets>(existing);
    } catch {
      /* illeggibile: vanno reinseriti */
    }
  }
  if (v.accessToken) secrets.accessToken = v.accessToken;
  if (v.appSecret) secrets.appSecret = v.appSecret;
  if (!secrets.accessToken || !secrets.appSecret) {
    return { ok: false, error: "Access Token e App Secret sono obbligatori" };
  }

  // Attivare richiede di dimostrare il possesso del numero: il token deve poter
  // leggere quel phoneNumberId sulla Graph API. Senza questo controllo
  // un'azienda potrebbe "occupare" il numero di un'altra (che non riuscirebbe
  // piu' ad attivarlo e vedrebbe i propri webhook rifiutati).
  if (v.active) {
    try {
      await fetchPhoneNumberInfo(v.phoneNumberId, secrets.accessToken);
    } catch (e) {
      return {
        ok: false,
        error: `Impossibile verificare il numero con questo Access Token: ${e instanceof Error ? e.message : "errore Graph API"}`,
      };
    }
  }

  // Un numero puo' appartenere a una sola azienda attiva. Lookup globale
  // (basePrisma) inevitabile: serve proprio a vedere le ALTRE aziende. Non
  // restituisce nulla di loro, solo l'esito.
  if (v.active) {
    const taken = await basePrisma.companyIntegration.count({
      where: { provider: "WHATSAPP", publicKey: v.phoneNumberId, active: true, companyId: { not: ctx.companyId } },
    });
    if (taken > 0) return { ok: false, error: "Questo numero WhatsApp e' gia' collegato a un'altra azienda" };
  }

  const prevMeta = (existing?.meta ?? {}) as WhatsAppMeta;
  const sameNumber = existing?.publicKey === v.phoneNumberId;
  const meta: WhatsAppMeta = {
    wabaId: v.wabaId,
    displayPhone: v.displayPhone,
    ...(sameNumber ? { verifiedName: prevMeta.verifiedName, lastCheckAt: prevMeta.lastCheckAt, lastCheckOk: prevMeta.lastCheckOk } : {}),
  };
  // Prisma 5 tipizza Bytes come Buffer, crypto.ts restituisce Uint8Array: si converte (stessi byte).
  const enc = encryptJson(secrets);
  const data = {
    publicKey: v.phoneNumberId,
    secretCipher: Buffer.from(enc.secretCipher),
    secretIv: Buffer.from(enc.secretIv),
    secretTag: Buffer.from(enc.secretTag),
    meta: meta as Prisma.InputJsonValue,
    active: v.active,
  };
  await ctx.db.companyIntegration.upsert({
    where: key,
    create: { companyId: ctx.companyId, provider: "WHATSAPP", ...data },
    update: data,
  });

  revalidatePath(`/${ctx.slug}/settings/integrations/whatsapp`);
  return { ok: true };
});

/** Chiama la Graph API sul numero salvato e registra l'esito. */
export const testWhatsAppConnection = companyAction(
  async (ctx): Promise<Result<{ displayPhone?: string; verifiedName?: string; quality?: string; subscribed?: boolean }>> => {
    await assertCanEditSettings(ctx);
    const key = { companyId_provider: { companyId: ctx.companyId, provider: "WHATSAPP" as const } };
    const row = await ctx.db.companyIntegration.findUnique({ where: key });
    if (!row) return { ok: false, error: "Salva prima la configurazione" };
    let cfg;
    try {
      cfg = integrationToConfig(row);
    } catch {
      cfg = null;
    }
    if (!cfg) return { ok: false, error: "Configurazione incompleta o segreti illeggibili: reinserisci token e App Secret" };

    const meta = (row.meta ?? {}) as WhatsAppMeta;
    try {
      const info = await fetchPhoneNumberInfo(cfg.phoneNumberId, cfg.accessToken);
      // Iscrizione dell'app al WABA (serve per ricevere i webhook). Se fallisce
      // per permessi, l'invio funziona comunque: lo si segnala soltanto.
      let subscribed = false;
      if (cfg.wabaId) {
        try { subscribed = await subscribeAppToWaba(cfg.wabaId, cfg.accessToken); } catch { subscribed = false; }
      }
      await ctx.db.companyIntegration.update({
        where: key,
        data: {
          meta: {
            ...meta,
            displayPhone: meta.displayPhone || info.display_phone_number || "",
            verifiedName: info.verified_name,
            lastCheckAt: new Date().toISOString(),
            lastCheckOk: true,
          } as Prisma.InputJsonValue,
        },
      });
      revalidatePath(`/${ctx.slug}/settings/integrations/whatsapp`);
      return {
        ok: true,
        data: { displayPhone: info.display_phone_number, verifiedName: info.verified_name, quality: info.quality_rating, subscribed },
      };
    } catch (e) {
      await ctx.db.companyIntegration.update({
        where: key,
        data: { meta: { ...meta, lastCheckAt: new Date().toISOString(), lastCheckOk: false } as Prisma.InputJsonValue },
      });
      revalidatePath(`/${ctx.slug}/settings/integrations/whatsapp`);
      return { ok: false, error: e instanceof Error ? e.message : "Verifica non riuscita" };
    }
  },
);

/** Scollega: cancella i segreti e disattiva. */
export const removeWhatsAppIntegration = companyAction(async (ctx): Promise<Result> => {
  await assertCanEditSettings(ctx);
  await ctx.db.companyIntegration.deleteMany({ where: { companyId: ctx.companyId, provider: "WHATSAPP" } });
  revalidatePath(`/${ctx.slug}/settings/integrations/whatsapp`);
  return { ok: true };
});
