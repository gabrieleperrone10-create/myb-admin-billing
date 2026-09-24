/**
 * Test dei calcoli dei report vendite (moduli puri, niente DB).
 *   npx tsx scripts/test-reports.mts
 */
import { prorateSpend, aggregateSpend, parseAmount, parseDay, parseSpendCsv, dayToStored } from "../src/lib/crm/reports/spend.js";
import { normalizeSource, contactChannel, campaignKey } from "../src/lib/crm/reports/sources.js";
import { computeFunnel, type FunnelStage, type FunnelOpportunity } from "../src/lib/crm/reports/funnel.js";
import { roas, cpl, cac, rate, deltaPct, safeDiv } from "../src/lib/crm/reports/metrics.js";
import { collectionEvents, sumByContact } from "../src/lib/crm/reports/revenue.js";
import { computeAttribution } from "../src/lib/crm/reports/attribution.js";
import { resolvePeriod, listBuckets, bucketKey, daysInclusive } from "../src/lib/crm/reports/period.js";

let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FALLITO"}  ${name}${detail ? "  — " + detail : ""}`);
  if (ok) pass++; else fail++;
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const near = (a: number | null, b: number, eps = 1e-6) => a !== null && Math.abs(a - b) < eps;

// ─── Pro-rata spesa ─────────────────────────────────────────────────────────
console.log("\n# Pro-rata spesa");
const sep = { source: "meta", campaign: "autunno", periodStart: dayToStored("2026-09-01"), periodEnd: dayToStored("2026-09-30"), amount: 300 };
t("spesa interamente dentro il periodo", near(prorateSpend(sep, "2026-08-01", "2026-10-31"), 300));
t("sovrapposizione parziale 10/30 giorni = 100", near(prorateSpend(sep, "2026-09-21", "2026-10-15"), 100));
t("un solo giorno = 10", near(prorateSpend(sep, "2026-09-15", "2026-09-15"), 10));
t("nessuna sovrapposizione = 0", prorateSpend(sep, "2026-10-01", "2026-10-31") === 0);
t("estremi inclusi (ultimo giorno)", near(prorateSpend(sep, "2026-09-30", "2026-10-05"), 10));
const oneDay = { ...sep, periodEnd: sep.periodStart, amount: 50 };
t("spesa di un giorno", near(prorateSpend(oneDay, "2026-09-01", "2026-09-01"), 50));
t("importo 0 -> 0", prorateSpend({ ...sep, amount: 0 }, "2026-09-01", "2026-09-30") === 0);
const agg = aggregateSpend([
  sep,
  { source: "Facebook", campaign: "Autunno ", periodStart: dayToStored("2026-09-01"), periodEnd: dayToStored("2026-09-10"), amount: 100 },
  { source: "google", campaign: null, periodStart: dayToStored("2026-09-01"), periodEnd: dayToStored("2026-09-30"), amount: 60 },
], "2026-09-01", "2026-09-15");
t("aggregato: totale pro-rata", near(agg.total, 150 + 100 + 30), String(agg.total));
t("aggregato: facebook -> meta, campagne unite case-insensitive", near(agg.bySource.get("meta")?.byCampaign.get("autunno") ?? null, 250));
t("aggregato: spesa senza campagna in chiave ''", near(agg.bySource.get("google")?.byCampaign.get("") ?? null, 30));

// ─── Normalizzazione fonti ──────────────────────────────────────────────────
console.log("\n# Normalizzazione fonti");
for (const raw of ["fb", "Facebook", " META ", "ig", "Instagram", "www.facebook.com", "https://l.instagram.com/"]) {
  t(`"${raw}" -> meta`, normalizeSource(raw) === "meta", String(normalizeSource(raw)));
}
t("google-ads -> google", normalizeSource("google-ads") === "google");
t("sconosciuta resta minuscola", normalizeSource("Newsletter-Ottobre") === "newsletter-ottobre");
t("vuota -> null", normalizeSource("  ") === null && normalizeSource(undefined) === null);
t("campaignKey trim+minuscolo", campaignKey("  Black Friday ") === "black friday");
t("canale da utm", eq(contactChannel({ source: "form:abc", attribution: { utm_source: "IG", utm_campaign: "Promo" } }), { source: "meta", campaign: "promo", campaignLabel: "Promo" }));
t("canale da gclid senza utm", contactChannel({ source: "form:abc", attribution: { gclid: "x" } }).source === "google");
t("canale da fbclid senza utm", contactChannel({ source: null, attribution: { fbclid: "x" } }).source === "meta");
t("ripiego form:<id> -> form", contactChannel({ source: "form:cl123", attribution: null }).source === "form");
t("ripiego booking/whatsapp/import/manual/billing", ["booking", "whatsapp", "import", "manual", "billing"].every(s => contactChannel({ source: s }).source === s));
t("nessuna fonte -> unknown", contactChannel({ source: null, attribution: {} }).source === "unknown");
t("attribution non oggetto ignorata", contactChannel({ source: "manual", attribution: "boh" }).source === "manual");

// ─── Imbuto ─────────────────────────────────────────────────────────────────
console.log("\n# Imbuto");
const stages: FunnelStage[] = [
  { id: "s1", name: "Nuovo", order: 0, kind: "OPEN", color: "#000" },
  { id: "s2", name: "Contattato", order: 1, kind: "OPEN", color: "#000" },
  { id: "s3", name: "Call", order: 2, kind: "OPEN", color: "#000" },
  { id: "w", name: "Vinto", order: 3, kind: "WON", color: "#0a0" },
  { id: "l", name: "Perso", order: 4, kind: "LOST", color: "#a00" },
];
const d = (day: number) => new Date(Date.UTC(2026, 8, day));
const opp = (id: string, status: FunnelOpportunity["status"], path: string[], days: number[], lostReason: string | null = null): FunnelOpportunity => ({
  id, status, stageId: path[path.length - 1], createdAt: d(days[0]), closedAt: status === "OPEN" ? null : d(days[days.length - 1]), lostReason,
  changes: path.map((s, i) => ({ fromStageId: i === 0 ? null : path[i - 1], toStageId: s, changedAt: d(days[i]) })),
});
const opps = [
  opp("a", "OPEN", ["s1"], [1]),                             // resta in s1
  opp("b", "OPEN", ["s1", "s3"], [1, 5]),                    // salta s2: conta come passata da s2
  opp("c", "WON", ["s1", "s2", "w"], [1, 3, 10]),            // vinta: tutte le fasi
  opp("d", "LOST", ["s1", "s2", "l"], [2, 4, 6], "prezzo"),  // persa dopo s2
  opp("e", "LOST", ["s1", "l"], [1, 2], " Prezzo "),         // persa in s1
];
const f = computeFunnel(stages, opps);
t("passi = fasi OPEN + Vinta", eq(f.steps.map(s => s.name), ["Nuovo", "Contattato", "Call", "Vinta"]));
t("regola 'fase N o successiva': 5,3,2,1", eq(f.steps.map(s => s.reached), [5, 3, 2, 1]), JSON.stringify(f.steps.map(s => s.reached)));
t("conversione fase->fase", near(f.steps[1].stepConversion, 60) && near(f.steps[2].stepConversion, 200 / 3) && near(f.steps[3].stepConversion, 50));
t("conversione dall'inizio", near(f.steps[3].totalConversion, 20));
t("conteggi monotoni", f.steps.every((s, i) => i === 0 || s.reached <= f.steps[i - 1].reached));
t("tasso di vittoria = 1/(1+2)", near(f.winRate, 100 / 3));
t("motivi di perdita raggruppati case-insensitive", eq(f.lostReasons, [{ reason: "Prezzo", count: 2 }]), JSON.stringify(f.lostReasons));
// tempo in s1: b 4gg, c 2gg, d 2gg, e 1gg (a ancora aperta: esclusa) -> 9/4
t("tempo medio in fase (solo permanenze concluse)", near(f.steps[0].avgDays, 9 / 4) && f.steps[0].timedCount === 4, String(f.steps[0].avgDays));
// s2: c 7gg (3->10), d 2gg (4->6) -> 4.5
t("tempo medio seconda fase", near(f.steps[1].avgDays, 4.5));
t("fase in corso non conteggiata (s3 di b)", f.steps[2].avgDays === null);
const legacy = computeFunnel(stages, [{ id: "z", status: "OPEN", stageId: "s2", createdAt: d(1), closedAt: null, lostReason: null, changes: [] }]);
t("dati senza storico: vale la fase attuale", eq(legacy.steps.map(s => s.reached), [1, 1, 0, 0]));
const empty = computeFunnel(stages, []);
t("imbuto vuoto: conversioni null, niente NaN", empty.winRate === null && empty.steps.every(s => s.reached === 0 && s.totalConversion === null));

// ─── Metriche e divisione per zero ─────────────────────────────────────────
console.log("\n# ROAS / CPL / CAC");
t("ROAS = incassato/spesa", near(roas(1500, 500), 3));
t("ROAS con spesa 0 -> null", roas(1500, 0) === null);
t("CPL = spesa/lead", near(cpl(500, 20), 25));
t("CPL con 0 lead -> null", cpl(500, 0) === null);
t("CPL con spesa 0 -> null (non 0 €)", cpl(0, 10) === null);
t("CAC = spesa/clienti", near(cac(900, 3), 300));
t("CAC con 0 clienti -> null", cac(900, 0) === null);
t("rate con denominatore 0 -> null", rate(0, 0) === null);
t("safeDiv NaN/Infinity -> null", safeDiv(NaN, 2) === null && safeDiv(1, Infinity) === null);
t("delta: 0 vs 0 = 0", deltaPct(0, 0) === 0);
t("delta: prev 0 -> null", deltaPct(5, 0) === null);
t("delta: +50%", near(deltaPct(150, 100), 50));
t("delta con null", deltaPct(null, 3) === null);

// ─── Incassato ────────────────────────────────────────────────────────────
console.log("\n# Incassato");
const ev = collectionEvents(
  [
    { id: "i1", contactId: "c1", amount: 1000, paidAt: d(5), issueDate: d(1), payment: { amount: 900, method: "BANK_TRANSFER", paidAt: d(6) } },
    { id: "i2", contactId: "c1", amount: 500, paidAt: null, issueDate: d(2), payment: null },
    { id: "i3", contactId: "c2", amount: 700, paidAt: d(3), issueDate: d(3), payment: { amount: 700, method: "STRIPE", paidAt: d(3) } },
  ],
  [
    { invoiceId: "i2", amount: 800, issueDate: d(9) },  // storno oltre l'importo: limitato a 500
    { invoiceId: "i3", amount: 100, issueDate: d(9) },  // fattura esclusa (Stripe): ignorata
    { invoiceId: null, amount: 50, issueDate: d(9) },   // manuale: ignorata
    { invoiceId: "iX", amount: 50, issueDate: d(9) },   // fattura non pagata: ignorata
  ],
);
const by = sumByContact(ev);
t("importo del Payment se presente, fattura altrimenti; nota limitata", by.get("c1") === 900, String(by.get("c1")));
t("Stripe escluso", !by.has("c2"));
t("data = Payment.paidAt", ev[0].at.getTime() === d(6).getTime());

// ─── Attribuzione ─────────────────────────────────────────────────────────
console.log("\n# Attribuzione");
const att = computeAttribution({
  contacts: [
    { id: "c1", source: "form:x", attribution: { utm_source: "fb", utm_campaign: "Autunno" }, lifecycle: "LEAD" },
    { id: "c2", source: "form:x", attribution: { utm_source: "instagram", utm_campaign: "autunno" }, lifecycle: "LEAD" },
    { id: "c3", source: "manual", attribution: null, lifecycle: "CUSTOMER" },
  ],
  opportunities: [{ contactId: "c1", status: "WON", value: 2000 }, { contactId: "c2", status: "OPEN", value: 800 }],
  wonContactIds: new Set(["c1"]),
  collectedByContact: new Map([["c1", 1200]]),
  spend: agg,
});
const meta = att.rows.find(r => r.key === "meta")!;
t("fb+instagram nella stessa fonte", meta.leads === 2);
t("campagna unita 'Autunno'/'autunno'", meta.campaigns.find(c => c.key === "autunno")?.leads === 2);
t("ROAS meta = 1200/250", near(meta.roas, 1200 / 250));
t("CPL meta = 250/2", near(meta.cpl, 125));
t("CAC meta = 250/1", near(meta.cac, 250));
t("lead->cliente meta 50%", near(meta.leadToCustomer, 50));
const google = att.rows.find(r => r.key === "google")!;
t("fonte con sola spesa: 0 lead, CPL null, ROAS 0", google.leads === 0 && google.cpl === null && google.roas === 0);
t("manual: cliente da lifecycle, spesa 0 -> CAC null", att.rows.find(r => r.key === "manual")?.customers === 1 && att.rows.find(r => r.key === "manual")?.cac === null);
t("totali coerenti", att.totals.leads === 3 && near(att.totals.spend, 280) && att.totals.collected === 1200);

// ─── CSV ────────────────────────────────────────────────────────────────────
console.log("\n# Import CSV");
t("importi italiani", parseAmount("1.234,56") === 1234.56 && parseAmount("1234,5") === 1234.5 && parseAmount("€ 1.500") === 1500 && parseAmount("12.5") === 12.5 && parseAmount("1,234.56") === 1234.56);
t("importi non validi", parseAmount("abc") === null && parseAmount("-5") === null && parseAmount("") === null);
t("date", parseDay("01/09/2026") === "2026-09-01" && parseDay("2026-09-01") === "2026-09-01" && parseDay("31/02/2026") === null && parseDay("1.9.2026") === "2026-09-01");
const csv1 = parseSpendCsv("data inizio;data fine;fonte;campagna;importo\n01/09/2026;30/09/2026;Facebook;Autunno;1.234,56\n01/09/2026;;google;;10\n");
t("CSV ; con intestazione", csv1.rows.length === 1 && csv1.rows[0].amount === 1234.56 && csv1.rows[0].source === "meta", JSON.stringify(csv1));
t("CSV riga con errore segnalata", csv1.errors.length === 1 && csv1.errors[0].line === 3);
const csv2 = parseSpendCsv('2026-09-01,2026-09-30,google,"Brand, IT","99,90"\n');
t("CSV , senza intestazione, virgolette e decimale con virgola", csv2.rows.length === 1 && csv2.rows[0].campaign === "Brand, IT" && csv2.rows[0].amount === 99.9, JSON.stringify(csv2));
const csv3 = parseSpendCsv("importo,fonte,data inizio,data fine\n50,ig,2026-09-01,2026-09-02\n");
t("CSV colonne in ordine diverso per nome", csv3.rows[0]?.amount === 50 && csv3.rows[0]?.campaign === null && csv3.rows[0]?.source === "meta");
t("CSV vuoto", parseSpendCsv("  ").errors.length === 1);

// ─── Periodi ───────────────────────────────────────────────────────────────
console.log("\n# Periodi");
const now = new Date("2026-09-24T10:00:00Z");
const p30 = resolvePeriod("30d", null, null, "Europe/Rome", now);
t("30 giorni inclusi oggi", p30.fromDay === "2026-08-26" && p30.toDay === "2026-09-24" && p30.days === 30);
t("periodo precedente di pari durata", p30.previous.toDay === "2026-08-25" && p30.previous.days === 30);
t("inizio = mezzanotte Roma (UTC+2)", p30.from.toISOString() === "2026-08-25T22:00:00.000Z");
const lm = resolvePeriod("lastmonth", null, null, "Europe/Rome", now);
t("mese scorso", lm.fromDay === "2026-08-01" && lm.toDay === "2026-08-31");
const cu = resolvePeriod("custom", "2026-09-10", "2026-09-01", "Europe/Rome", now);
t("personalizzato con date invertite", cu.fromDay === "2026-09-01" && cu.toDay === "2026-09-10");
t("preset non valido -> 30d", resolvePeriod("boh", null, null, "Europe/Rome", now).preset === "30d");
t("settimana ISO parte di lunedì", bucketKey("2026-09-24", "week") === "2026-09-21");
t("bucket giornalieri = giorni", listBuckets(p30, "day").length === 30 && daysInclusive("2026-01-01", "2026-12-31") === 365);

console.log(`\n${pass} passati, ${fail} falliti`);
if (fail > 0) process.exit(1);
