import "server-only";

/**
 * Rate limit best-effort, in memoria, per istanza del processo.
 *
 * Su Vercel/serverless ogni istanza (e ogni regione, e ogni cold start) ha la
 * sua mappa: NON e' un limite globale condiviso fra istanze. Basta a
 * scoraggiare gli abusi piu' grezzi (uno script che martella lo stesso
 * endpoint dalla stessa istanza), non sostituisce un limite vero — per quello
 * servirebbe uno store condiviso (Redis/Upstash), fuori dal perimetro di
 * questo agente.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** true se la richiesta e' ammessa, false se ha superato il limite della finestra. */
export function checkRateLimit(key: string, opts: { windowMs: number; max: number }): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    if (buckets.size > 5000) pruneExpired(now); // niente crescita illimitata della mappa
    return true;
  }
  if (b.count >= opts.max) return false;
  b.count++;
  return true;
}

function pruneExpired(now: number) {
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/** IP del chiamante da header standard (Vercel/proxy). "unknown" se assente: il
 * rate limit degrada a "condiviso fra tutte le richieste senza IP", accettabile
 * come ultima difesa best-effort. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
