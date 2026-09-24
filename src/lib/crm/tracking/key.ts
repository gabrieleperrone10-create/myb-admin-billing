import "server-only";
import { randomBytes } from "crypto";
import { basePrisma } from "@/lib/db";

/**
 * Chiave pubblica di tracciamento (Company.trackingKey). Non e' un segreto:
 * finisce nell'HTML di siti di terzi (`<script data-key="...">`), quindi
 * identifica solo *quale* azienda, non autorizza nulla da sola.
 *
 * Company non e' in TENANT_MODELS (src/lib/db.ts): e' la riga stessa
 * dell'azienda, quindi si usa basePrisma direttamente, filtrando per id.
 */
export async function ensureTrackingKey(companyId: string): Promise<string> {
  const company = await basePrisma.company.findUnique({
    where: { id: companyId },
    select: { trackingKey: true },
  });
  if (!company) throw new Error(`[tracking] azienda "${companyId}" non trovata`);
  if (company.trackingKey) return company.trackingKey;

  // updateMany con `trackingKey: null` nel where sfrutta il lock di riga di
  // Postgres: se due richieste concorrenti generano ciascuna una chiave, la
  // seconda UPDATE si blocca sulla riga, poi ri-valuta il WHERE dopo il commit
  // della prima e trova trackingKey gia' valorizzato -> count 0. Niente due
  // scritture che si sovrascrivono silenziosamente.
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateKey();
    try {
      const { count } = await basePrisma.company.updateMany({
        where: { id: companyId, trackingKey: null },
        data: { trackingKey: key },
      });
      if (count > 0) return key;

      const current = await basePrisma.company.findUnique({
        where: { id: companyId },
        select: { trackingKey: true },
      });
      if (current?.trackingKey) return current.trackingKey;
      // altrimenti l'azienda e' sparita nel frattempo: si riprova
    } catch {
      // collisione sull'unique (astronomicamente improbabile con 128 bit): riprova
      continue;
    }
  }
  throw new Error("[tracking] impossibile generare una chiave di tracciamento univoca");
}

function generateKey(): string {
  return randomBytes(16).toString("base64url"); // ~22 caratteri, URL-safe
}
