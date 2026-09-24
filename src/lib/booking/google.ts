import "server-only";
// Import mirati (non il pacchetto monolitico "googleapis", che include le
// definizioni di tutte le API Google ed esaurisce la memoria durante il
// type-check di `next build`): solo il client OAuth2 e la sola API Calendar.
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { calendar as calendarApi } from "@googleapis/calendar";
import type { UserCalendarConnection } from "@prisma/client";
import { companyDb } from "@/lib/db";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import type { BusyInterval } from "./slots";

/**
 * Integrazione Google Calendar per utente (host), portata da Nutrizionisti-app
 * `src/lib/googleCalendar.ts`.
 *
 * Ogni membro dell'azienda collega il proprio account Google: il refresh token
 * cifrato vive in UserCalendarConnection (companyId + clerkUserId). Da quel
 * momento gli appuntamenti di cui e' host finiscono sul suo calendario
 * "primary" (con Google Meet se il calendario e' "video") e la disponibilita'
 * pubblica tiene conto dei suoi impegni (freebusy).
 *
 * Tutto e' opzionale: senza GOOGLE_CLIENT_ID/SECRET/TOKEN_ENCRYPTION_KEY, o
 * senza collegamento, ogni funzione degrada (null / [] / "not_connected") e la
 * prenotazione funziona lo stesso. Un errore Google non fa MAI fallire una
 * prenotazione: si registra in lastError e la UI mostra "ricollega".
 */

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** Prefisso di lastError per un token revocato: finche' c'e', non si chiama piu' Google. */
export const REVOKED_PREFIX = "Accesso revocato";

export class GoogleCalendarUserError extends Error {}

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && isEncryptionConfigured();
}

function oauthClient(redirectUri?: string) {
  if (!isGoogleConfigured()) throw new GoogleCalendarUserError("Integrazione Google Calendar non configurata");
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    // Forza il consenso: Google riemette sempre il refresh token anche a chi
    // aveva gia' autorizzato l'app in passato.
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeAndConnect(params: {
  code: string;
  redirectUri: string;
  companyId: string;
  clerkUserId: string;
}): Promise<{ email: string | null }> {
  const client = oauthClient(params.redirectUri);
  const { tokens } = await client.getToken(params.code);
  if (!tokens.refresh_token) {
    throw new GoogleCalendarUserError(
      "Google non ha restituito un refresh token. Rimuovi l'accesso all'app da https://myaccount.google.com/permissions e ripeti il collegamento.",
    );
  }

  let email: string | null = null;
  try {
    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      email = ticket.getPayload()?.email ?? null;
    }
  } catch {
    // solo per mostrare "collegato come X"
  }

  const db = companyDb(params.companyId);
  const enc = encryptSecret(tokens.refresh_token);
  // Prisma 5 tipizza le colonne Bytes come Buffer
  const secret = {
    secretCipher: Buffer.from(enc.secretCipher),
    secretIv: Buffer.from(enc.secretIv),
    secretTag: Buffer.from(enc.secretTag),
  };
  await db.userCalendarConnection.upsert({
    where: { companyId_clerkUserId_provider: { companyId: params.companyId, clerkUserId: params.clerkUserId, provider: "GOOGLE" } },
    create: { companyId: params.companyId, clerkUserId: params.clerkUserId, provider: "GOOGLE", email, ...secret },
    update: { email, ...secret, connectedAt: new Date(), lastError: null, lastErrorAt: null },
  });
  return { email };
}

export async function getConnection(companyId: string, clerkUserId: string) {
  return companyDb(companyId).userCalendarConnection.findFirst({ where: { clerkUserId, provider: "GOOGLE" } });
}

export async function disconnectGoogle(companyId: string, clerkUserId: string): Promise<void> {
  const db = companyDb(companyId);
  const conn = await db.userCalendarConnection.findFirst({ where: { clerkUserId, provider: "GOOGLE" } });
  if (!conn) return;
  // Revoca best-effort lato Google: se fallisce, il token resta comunque
  // cancellato qui e non verra' piu' usato.
  try {
    if (isGoogleConfigured()) await oauthClient().revokeToken(decryptSecret(conn));
  } catch { /* ignorato */ }
  await db.userCalendarConnection.delete({ where: { id: conn.id } });
}

/** Stato del collegamento per la UI. */
export function connectionState(conn: Pick<UserCalendarConnection, "lastError"> | null): "none" | "ok" | "error" | "revoked" {
  if (!conn) return "none";
  if (conn.lastError?.startsWith(REVOKED_PREFIX)) return "revoked";
  if (conn.lastError) return "error";
  return "ok";
}

// ─── Client autorizzato + gestione errori ─────────────────────────────────

type Authorized = { api: ReturnType<typeof calendarApi>; conn: UserCalendarConnection };

async function authorized(companyId: string, clerkUserId: string): Promise<Authorized | null> {
  if (!isGoogleConfigured()) return null;
  const conn = await getConnection(companyId, clerkUserId);
  if (!conn || conn.lastError?.startsWith(REVOKED_PREFIX)) return null;
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(conn);
  } catch (e) {
    await recordError(companyId, conn.id, `${REVOKED_PREFIX}: token non decifrabile (${String(e)})`);
    return null;
  }
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return { api: calendarApi({ version: "v3", auth: client }), conn };
}

const TOKEN_REVOKED_ERROR_CODES = ["invalid_grant", "unauthorized_client", "invalid_client"];

function isTokenRevokedError(error: unknown): boolean {
  const gaxiosCode = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (gaxiosCode && TOKEN_REVOKED_ERROR_CODES.includes(gaxiosCode)) return true;
  const status = (error as { code?: number; status?: number })?.code ?? (error as { status?: number })?.status;
  if (status === 401) return true;
  const message = error instanceof Error ? error.message : String(error);
  return TOKEN_REVOKED_ERROR_CODES.some(code => message.includes(code));
}

async function recordError(companyId: string, connectionId: string, message: string) {
  try {
    await companyDb(companyId).userCalendarConnection.update({
      where: { id: connectionId },
      data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
    });
  } catch { /* il log dell'errore non deve mai propagare */ }
}

async function handleError(companyId: string, a: Authorized, what: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[google] ${what}:`, error);
  await recordError(
    companyId,
    a.conn.id,
    isTokenRevokedError(error) ? `${REVOKED_PREFIX}: ricollega Google Calendar (${msg})` : `${what}: ${msg}`,
  );
}

async function clearErrorIfAny(companyId: string, a: Authorized) {
  if (!a.conn.lastError) return;
  try {
    await companyDb(companyId).userCalendarConnection.update({ where: { id: a.conn.id }, data: { lastError: null, lastErrorAt: null } });
  } catch { /* ignorato */ }
}

// ─── Eventi ────────────────────────────────────────────────────────────────

export async function createGoogleEvent(params: {
  companyId: string;
  hostUserId: string;
  summary: string;
  description?: string;
  location?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  attendee?: { email: string; name?: string } | null;
  createMeetLink?: boolean;
}): Promise<{ eventId: string; meetLink: string | null } | null> {
  const a = await authorized(params.companyId, params.hostUserId);
  if (!a) return null;
  try {
    const res = await a.api.events.insert({
      calendarId: "primary",
      sendUpdates: params.attendee ? "all" : "none",
      ...(params.createMeetLink ? { conferenceDataVersion: 1 } : {}),
      requestBody: {
        summary: params.summary,
        description: params.description,
        ...(params.location ? { location: params.location } : {}),
        start: { dateTime: params.start.toISOString(), timeZone: params.timeZone },
        end: { dateTime: params.end.toISOString(), timeZone: params.timeZone },
        ...(params.attendee ? { attendees: [{ email: params.attendee.email, displayName: params.attendee.name }] } : {}),
        ...(params.createMeetLink
          ? { conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } } }
          : {}),
      },
    });
    await clearErrorIfAny(params.companyId, a);
    if (!res.data.id) return null;
    return { eventId: res.data.id, meetLink: res.data.hangoutLink ?? null };
  } catch (e) {
    await handleError(params.companyId, a, "Creazione evento", e);
    return null;
  }
}

export async function updateGoogleEvent(params: {
  companyId: string;
  hostUserId: string;
  eventId: string;
  start: Date;
  end: Date;
  timeZone: string;
}): Promise<boolean> {
  const a = await authorized(params.companyId, params.hostUserId);
  if (!a) return false;
  try {
    await a.api.events.patch({
      calendarId: "primary",
      eventId: params.eventId,
      sendUpdates: "all",
      requestBody: {
        start: { dateTime: params.start.toISOString(), timeZone: params.timeZone },
        end: { dateTime: params.end.toISOString(), timeZone: params.timeZone },
      },
    });
    await clearErrorIfAny(params.companyId, a);
    return true;
  } catch (e) {
    await handleError(params.companyId, a, "Aggiornamento evento", e);
    return false;
  }
}

export type GoogleDeleteOutcome = "deleted" | "not_connected" | "failed";

export async function deleteGoogleEvent(params: {
  companyId: string;
  hostUserId: string;
  eventId: string;
}): Promise<GoogleDeleteOutcome> {
  const a = await authorized(params.companyId, params.hostUserId);
  if (!a) return "not_connected";
  try {
    await a.api.events.delete({ calendarId: "primary", eventId: params.eventId, sendUpdates: "all" });
    return "deleted";
  } catch (e) {
    // gia' cancellato a mano su Google: l'obiettivo e' raggiunto
    const status = (e as { code?: number })?.code;
    if (status === 410 || status === 404) return "deleted";
    await handleError(params.companyId, a, "Eliminazione evento", e);
    return "failed";
  }
}

/** Impegni dell'host su Google nella finestra. [] se non collegato o in errore. */
export async function getGoogleBusy(companyId: string, hostUserId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  const a = await authorized(companyId, hostUserId);
  if (!a) return [];
  try {
    const res = await a.api.freebusy.query({
      requestBody: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: "primary" }] },
    });
    await clearErrorIfAny(companyId, a);
    return (res.data.calendars?.primary?.busy ?? [])
      .filter(b => b.start && b.end)
      .map(b => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  } catch (e) {
    await handleError(companyId, a, "Lettura disponibilità", e);
    return [];
  }
}

/** Host con Google collegato e funzionante (per decidere se offrire Meet). */
export async function hasWorkingGoogle(companyId: string, hostUserId: string): Promise<boolean> {
  if (!isGoogleConfigured()) return false;
  const conn = await getConnection(companyId, hostUserId);
  return connectionState(conn) === "ok" || connectionState(conn) === "error";
}
