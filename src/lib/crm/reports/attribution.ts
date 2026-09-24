/**
 * Tabella di attribuzione per fonte / campagna. Modulo PURO: riceve dati gia'
 * caricati e restituisce righe serializzabili (passano a un Client Component).
 *
 * Coorte: i lead (Contact) CREATI nel periodo. Per ciascuno si contano le sue
 * opportunita' (qualunque data, rispettando il filtro pipeline), quelle vinte,
 * il valore vinto e l'incassato ad oggi (vedi revenue.ts). La spesa e' quella
 * del periodo, ripartita pro-rata (vedi spend.ts). Quindi:
 *   ROAS = incassato dalla coorte / spesa del periodo
 *   CPL  = spesa / lead;  CAC = spesa / clienti della coorte
 * Un lead e' "cliente" se lifecycle = CUSTOMER, oppure ha un'opportunita' vinta
 * (qualunque pipeline), oppure ha incassato > 0.
 */
import { cac, cpl, rate, roas } from "./metrics";
import { contactChannel, NO_CAMPAIGN_KEY, NO_CAMPAIGN_LABEL, sourceLabel } from "./sources";
import type { SpendAggregate } from "./spend";

export type AttributionMetrics = {
  leads: number;
  opportunities: number;
  won: number;
  wonValue: number;
  collected: number;
  customers: number;
  spend: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  /** % lead -> cliente */
  leadToCustomer: number | null;
};

export type CampaignRow = AttributionMetrics & { key: string; label: string };
export type SourceRow = AttributionMetrics & { key: string; label: string; campaigns: CampaignRow[] };

export type CohortContact = {
  id: string;
  source: string | null;
  attribution: unknown;
  lifecycle: string;
};

export type CohortOpportunity = { contactId: string; status: string; value: number };

type Acc = Omit<AttributionMetrics, "cpl" | "cac" | "roas" | "leadToCustomer">;

function emptyAcc(): Acc {
  return { leads: 0, opportunities: 0, won: 0, wonValue: 0, collected: 0, customers: 0, spend: 0 };
}

function finish(a: Acc): AttributionMetrics {
  return {
    ...a,
    cpl: cpl(a.spend, a.leads),
    cac: cac(a.spend, a.customers),
    roas: roas(a.collected, a.spend),
    leadToCustomer: rate(a.customers, a.leads),
  };
}

export function isCustomer(c: CohortContact, wonContactIds: Set<string>, collected: Map<string, number>): boolean {
  return c.lifecycle === "CUSTOMER" || wonContactIds.has(c.id) || (collected.get(c.id) ?? 0) > 0;
}

export function computeAttribution(input: {
  contacts: CohortContact[];
  opportunities: CohortOpportunity[];
  /** contatti con almeno un'opportunita' vinta, senza filtro pipeline */
  wonContactIds: Set<string>;
  collectedByContact: Map<string, number>;
  spend: SpendAggregate;
}): { rows: SourceRow[]; totals: AttributionMetrics } {
  const oppsByContact = new Map<string, CohortOpportunity[]>();
  for (const o of input.opportunities) {
    const l = oppsByContact.get(o.contactId);
    if (l) l.push(o); else oppsByContact.set(o.contactId, [o]);
  }

  const sources = new Map<string, { acc: Acc; campaigns: Map<string, { acc: Acc; label: string }> }>();
  const getSource = (key: string) => {
    let s = sources.get(key);
    if (!s) { s = { acc: emptyAcc(), campaigns: new Map() }; sources.set(key, s); }
    return s;
  };
  const getCampaign = (src: ReturnType<typeof getSource>, key: string, label: string | null) => {
    let c = src.campaigns.get(key);
    if (!c) {
      c = { acc: emptyAcc(), label: key === NO_CAMPAIGN_KEY ? NO_CAMPAIGN_LABEL : (label ?? key) };
      src.campaigns.set(key, c);
    }
    return c;
  };
  const totals = emptyAcc();

  for (const c of input.contacts) {
    const ch = contactChannel(c);
    const src = getSource(ch.source);
    const camp = getCampaign(src, ch.campaign, ch.campaignLabel);
    const opps = oppsByContact.get(c.id) ?? [];
    const wonOpps = opps.filter(o => o.status === "WON");
    const delta: Acc = {
      leads: 1,
      opportunities: opps.length,
      won: wonOpps.length,
      wonValue: wonOpps.reduce((s, o) => s + (o.value || 0), 0),
      collected: input.collectedByContact.get(c.id) ?? 0,
      customers: isCustomer(c, input.wonContactIds, input.collectedByContact) ? 1 : 0,
      spend: 0,
    };
    for (const a of [src.acc, camp.acc, totals]) add(a, delta);
  }

  for (const [srcKey, s] of input.spend.bySource) {
    const src = getSource(srcKey);
    src.acc.spend += s.total;
    totals.spend += s.total;
    for (const [ck, amt] of s.byCampaign) {
      getCampaign(src, ck, s.campaignLabels.get(ck) ?? null).acc.spend += amt;
    }
  }

  const rows: SourceRow[] = [...sources.entries()].map(([key, s]) => ({
    key,
    label: sourceLabel(key),
    ...finish(s.acc),
    campaigns: [...s.campaigns.entries()]
      .map(([ck, c]) => ({ key: ck, label: c.label, ...finish(c.acc) }))
      .sort((a, b) => b.collected - a.collected || b.leads - a.leads || b.spend - a.spend),
  }));
  rows.sort((a, b) => b.collected - a.collected || b.leads - a.leads || b.spend - a.spend);
  return { rows, totals: finish(totals) };
}

function add(a: Acc, d: Acc) {
  a.leads += d.leads;
  a.opportunities += d.opportunities;
  a.won += d.won;
  a.wonValue += d.wonValue;
  a.collected += d.collected;
  a.customers += d.customers;
  a.spend += d.spend;
}
