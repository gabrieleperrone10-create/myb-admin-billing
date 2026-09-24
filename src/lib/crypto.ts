import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifratura dei segreti a riposo (token WhatsApp, refresh token Google).
 *
 * AES-256-GCM con chiave da TOKEN_ENCRYPTION_KEY (base64, 32 byte:
 * `openssl rand -base64 32`). Il formato ricalca le colonne gia' presenti su
 * CompanyIntegration e UserCalendarConnection: cipher / iv / tag separati come
 * Bytes, cosi' non serve parsare stringhe composite.
 *
 * GCM autentica il contenuto: un tag che non torna fa lanciare decryptSecret()
 * invece di restituire spazzatura — un segreto manomesso o cifrato con un'altra
 * chiave e' un errore, non un valore.
 */

/** Buffer: e' il tipo che Prisma 5 usa per le colonne Bytes. */
export type EncryptedSecret = {
  secretCipher: Buffer;
  secretIv: Buffer;
  secretTag: Buffer;
};

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY non impostata");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY deve essere di 32 byte (base64)");
  return k;
}

export function isEncryptionConfigured(): boolean {
  try { key(); return true; } catch { return false; }
}

export function encryptSecret(plain: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    secretCipher: enc,
    secretIv: iv,
    secretTag: cipher.getAuthTag(),
  };
}

export function decryptSecret(s: {
  secretCipher: Uint8Array | null;
  secretIv: Uint8Array | null;
  secretTag: Uint8Array | null;
}): string {
  if (!s.secretCipher || !s.secretIv || !s.secretTag) throw new Error("Segreto assente");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(s.secretIv));
  decipher.setAuthTag(Buffer.from(s.secretTag));
  return Buffer.concat([decipher.update(Buffer.from(s.secretCipher)), decipher.final()]).toString("utf8");
}

/** Per segreti strutturati (es. { accessToken, appSecret } di WhatsApp). */
export function encryptJson(value: unknown): EncryptedSecret {
  return encryptSecret(JSON.stringify(value));
}

export function decryptJson<T>(s: Parameters<typeof decryptSecret>[0]): T {
  return JSON.parse(decryptSecret(s)) as T;
}
