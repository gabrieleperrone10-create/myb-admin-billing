import "server-only";
import { headers } from "next/headers";

/**
 * Origine pubblica (scheme + host) da usare negli snippet copiabili (link
 * form, embed, tracciamento). Derivata dall'header Host della richiesta:
 * un'app multi-tenant su Vercel non ha un dominio fisso da tenere in una env
 * var (preview, produzione, domini custom per azienda in futuro), quindi si
 * legge da dove arriva davvero la richiesta.
 */
export async function getPublicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
