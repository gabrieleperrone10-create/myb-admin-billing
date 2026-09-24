/**
 * Imbuto per fase. Modulo PURO.
 *
 * REGOLA DI RAGGIUNGIMENTO ("ha raggiunto la fase N o una successiva"):
 *  - i passi dell'imbuto sono le fasi OPEN della pipeline in ordine (`order`),
 *    seguite da un passo finale "Vinta" (tutte le fasi WON insieme);
 *  - per ogni opportunita' si ricostruiscono le fasi in cui e' entrata da
 *    OpportunityStageChange (toStageId; la prima riga, con fromStageId null, e'
 *    la fase iniziale), piu' la fase attuale come ripiego per i dati storici;
 *  - la sua "fase massima" e' la fase OPEN di ordine piu' alto mai raggiunta;
 *    un'opportunita' conta come arrivata a TUTTE le fasi fino a quella, anche se
 *    le ha saltate (spostamento diretto sul kanban);
 *  - un'opportunita' VINTA ha raggiunto tutte le fasi OPEN e il passo "Vinta";
 *  - una PERSA conta fino alla fase massima raggiunta prima di essere persa
 *    (le fasi LOST non sono un passo dell'imbuto);
 *  - fasi di altre pipeline (opportunita' spostate di pipeline) vengono ignorate.
 *  Cosi' i conteggi sono monotoni non crescenti e la conversione fase->fase e'
 *  sempre <= 100%.
 *
 * TEMPO IN FASE: differenza fra ingressi consecutivi (ingresso nella fase ->
 * ingresso nella successiva, qualunque essa sia). Si contano solo permanenze
 * CONCLUSE: la permanenza in corso di un'opportunita' ancora aperta non entra
 * nella media. Se un'opportunita' rientra in una fase, le permanenze si sommano.
 * La media e' per opportunita' (non per singolo passaggio).
 */

export type FunnelStage = { id: string; name: string; order: number; kind: "OPEN" | "WON" | "LOST"; color: string };

export type FunnelOpportunity = {
  id: string;
  status: "OPEN" | "WON" | "LOST";
  stageId: string;
  createdAt: Date;
  closedAt: Date | null;
  lostReason: string | null;
  changes: { fromStageId: string | null; toStageId: string; changedAt: Date }[];
};

export type FunnelStep = {
  key: string;
  name: string;
  color: string;
  kind: "OPEN" | "WON";
  reached: number;
  /** % rispetto al passo precedente (null per il primo o se il precedente e' 0) */
  stepConversion: number | null;
  /** % rispetto al primo passo */
  totalConversion: number | null;
  /** giorni medi di permanenza (null se nessuna permanenza conclusa) */
  avgDays: number | null;
  /** opportunita' con almeno una permanenza conclusa nella fase */
  timedCount: number;
};

export type FunnelResult = {
  total: number;
  steps: FunnelStep[];
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  lostReasons: { reason: string; count: number }[];
};

export const NO_REASON_LABEL = "Non specificato";
const DAY_MS = 86_400_000;

/** Ingressi in fase ordinati nel tempo. */
export function stageEntries(opp: FunnelOpportunity): { stageId: string; at: Date }[] {
  const changes = [...opp.changes].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  const entries: { stageId: string; at: Date }[] = [];
  if (changes.length === 0) return [{ stageId: opp.stageId, at: opp.createdAt }];
  // Dati precedenti al log della creazione: la prima riga ha un fromStageId -> quella
  // fase e' la fase iniziale, entrata alla creazione.
  if (changes[0].fromStageId) entries.push({ stageId: changes[0].fromStageId, at: opp.createdAt });
  for (const c of changes) entries.push({ stageId: c.toStageId, at: c.changedAt });
  return entries;
}

/** Indice (nei passi OPEN) della fase massima raggiunta; -1 se nessuna fase OPEN della pipeline. */
export function maxReachedIndex(opp: FunnelOpportunity, openStageIds: string[]): number {
  if (opp.status === "WON") return openStageIds.length - 1;
  const idx = new Map(openStageIds.map((id, i) => [id, i]));
  let max = -1;
  const ids = new Set(stageEntries(opp).map(e => e.stageId));
  ids.add(opp.stageId);
  for (const id of ids) {
    const i = idx.get(id);
    if (i !== undefined && i > max) max = i;
  }
  return max;
}

export function normalizeLostReason(r: string | null | undefined): string {
  const s = (r ?? "").trim().replace(/\s+/g, " ");
  if (!s) return NO_REASON_LABEL;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function computeFunnel(stages: FunnelStage[], opps: FunnelOpportunity[], topReasons = 8): FunnelResult {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const open = sorted.filter(s => s.kind === "OPEN");
  const openIds = open.map(s => s.id);
  const wonIds = new Set(sorted.filter(s => s.kind === "WON").map(s => s.id));
  const stageIds = new Set(sorted.map(s => s.id));

  const reached = new Array<number>(open.length).fill(0);
  let wonCount = 0, lostCount = 0, openCount = 0;
  // permanenza totale per fase OPEN, per opportunita'
  const durSum = new Array<number>(open.length).fill(0);
  const durCnt = new Array<number>(open.length).fill(0);
  const openIndex = new Map(openIds.map((id, i) => [id, i]));
  const reasons = new Map<string, number>();

  for (const o of opps) {
    if (o.status === "WON") wonCount++;
    else if (o.status === "LOST") lostCount++;
    else openCount++;

    // Un'opportunita' vinta ma senza fasi OPEN nella pipeline conta comunque come vinta.
    const max = maxReachedIndex(o, openIds);
    for (let i = 0; i <= max; i++) reached[i]++;

    if (o.status === "LOST") {
      const key = normalizeLostReason(o.lostReason);
      // raggruppamento case-insensitive, si mostra la prima grafia incontrata
      const existing = [...reasons.keys()].find(k => k.toLowerCase() === key.toLowerCase());
      reasons.set(existing ?? key, (reasons.get(existing ?? key) ?? 0) + 1);
    }

    const entries = stageEntries(o).filter(e => stageIds.has(e.stageId));
    const perStage = new Map<number, number>();
    for (let i = 0; i < entries.length - 1; i++) {
      const si = openIndex.get(entries[i].stageId);
      if (si === undefined) continue;
      const d = entries[i + 1].at.getTime() - entries[i].at.getTime();
      if (d < 0) continue;
      perStage.set(si, (perStage.get(si) ?? 0) + d);
    }
    for (const [si, d] of perStage) {
      durSum[si] += d;
      durCnt[si]++;
    }
  }

  const steps: FunnelStep[] = open.map((s, i) => ({
    key: s.id,
    name: s.name,
    color: s.color,
    kind: "OPEN" as const,
    reached: reached[i],
    stepConversion: i === 0 ? null : pct(reached[i], reached[i - 1]),
    totalConversion: pct(reached[i], reached[0] ?? 0),
    avgDays: durCnt[i] > 0 ? durSum[i] / durCnt[i] / DAY_MS : null,
    timedCount: durCnt[i],
  }));

  const firstReached = steps[0]?.reached ?? wonCount;
  const lastReached = steps.length ? steps[steps.length - 1].reached : null;
  steps.push({
    key: "__won",
    name: "Vinta",
    color: sorted.find(s => wonIds.has(s.id))?.color ?? "#10b981",
    kind: "WON",
    reached: wonCount,
    stepConversion: lastReached === null ? null : pct(wonCount, lastReached),
    totalConversion: pct(wonCount, firstReached),
    avgDays: null,
    timedCount: 0,
  });

  const lostReasons = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "it"))
    .slice(0, topReasons);

  return {
    total: opps.length,
    steps,
    won: wonCount,
    lost: lostCount,
    open: openCount,
    winRate: pct(wonCount, wonCount + lostCount),
    lostReasons,
  };
}

function pct(a: number, b: number): number | null {
  return b > 0 ? (a / b) * 100 : null;
}
