/**
 * Test della visibilita' "Solo assegnati" (lib/visibility.ts + lib/db.ts).
 * Gira sul DB locale: crea dati di prova marcati e li rimuove alla fine.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env scripts/test-visibility.mts
 */
import { companyDb, basePrisma } from "../src/lib/db.js";
import type { AppSection } from "@prisma/client";

const COMPANY = "singleton";
const ME = "vis-test-user-me";
const OTHER = "vis-test-user-other";
const TAG = `vis-${Date.now()}`;
let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FALLITO"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const admin = companyDb(COMPANY);
const ALL_OWN: AppSection[] = ["CONTACTS", "CONVERSATIONS", "PIPELINES", "TASKS", "CALENDARS", "CLIENTS", "CONTRACTS", "INVOICES", "PAYMENTS", "CREDIT_NOTES", "DEPOSITS"];
const mine = companyDb(COMPANY, { userId: ME, own: new Set(ALL_OWN) });

// ─── dati di prova ──────────────────────────────────────────────────────────
const cOwned = await admin.contact.create({ data: { companyId: COMPANY, firstName: "Owned", email: `${TAG}-owned@example.com`, ownerUserId: ME } });
const cAssigned = await admin.contact.create({ data: { companyId: COMPANY, firstName: "Assigned", email: `${TAG}-assigned@example.com`, ownerUserId: OTHER } });
await admin.contactAssignee.create({ data: { companyId: COMPANY, contactId: cAssigned.id, userId: ME } });
const cHidden = await admin.contact.create({ data: { companyId: COMPANY, firstName: "Hidden", email: `${TAG}-hidden@example.com`, ownerUserId: OTHER } });
const pipe = await admin.pipeline.findFirst() ?? await admin.pipeline.create({ data: { companyId: COMPANY, name: "Test" } });
const stage = await admin.pipelineStage.findFirst({ where: { pipelineId: pipe.id } }) ?? await admin.pipelineStage.create({ data: { companyId: COMPANY, pipelineId: pipe.id, name: "S" } });
const oppHidden = await admin.opportunity.create({ data: { companyId: COMPANY, name: `${TAG} hidden`, contactId: cHidden.id, pipelineId: pipe.id, stageId: stage.id } });
const oppMineOnHidden = await admin.opportunity.create({ data: { companyId: COMPANY, name: `${TAG} mine`, contactId: cHidden.id, pipelineId: pipe.id, stageId: stage.id, ownerUserId: ME } });
const clHidden = await admin.client.create({ data: { companyId: COMPANY, name: "Hidden client", email: `${TAG}-clh@example.com`, contactId: cHidden.id } });
const clMine = await admin.client.create({ data: { companyId: COMPANY, name: "My client", email: `${TAG}-clm@example.com`, contactId: cOwned.id } });
const invMine = await admin.invoice.create({ data: { companyId: COMPANY, number: `${TAG}-1`, clientId: clMine.id, amount: 10, dueDate: new Date(), lineItems: [] } });
const invHidden = await admin.invoice.create({ data: { companyId: COMPANY, number: `${TAG}-2`, clientId: clHidden.id, amount: 20, dueDate: new Date(), lineItems: [] } });
const payHidden = await admin.payment.create({ data: { companyId: COMPANY, invoiceId: invHidden.id, amount: 20, method: "BANK_TRANSFER" } });
const taskAssigned = await admin.task.create({ data: { companyId: COMPANY, title: `${TAG} assegnato a me`, contactId: cHidden.id, assigneeUserId: ME } });
const taskHidden = await admin.task.create({ data: { companyId: COMPANY, title: `${TAG} nascosto`, contactId: cHidden.id, assigneeUserId: OTHER } });

try {
  // ─── contatti ─────────────────────────────────────────────────────────────
  const visible = await mine.contact.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const ids = new Set(visible.map(v => v.id));
  t("vede il contatto di cui e' responsabile", ids.has(cOwned.id));
  t("vede il contatto a cui e' assegnato", ids.has(cAssigned.id));
  t("NON vede il contatto di altri", !ids.has(cHidden.id));
  t("count coerente", (await mine.contact.count({ where: { email: { startsWith: TAG } } })) === 2);
  t("findUnique per id di un contatto altrui = null", (await mine.contact.findUnique({ where: { id: cHidden.id } })) === null);
  t("findUnique per id di un contatto suo", (await mine.contact.findUnique({ where: { id: cOwned.id } }))?.id === cOwned.id);
  const upd = await mine.contact.updateMany({ where: { id: cHidden.id }, data: { firstName: "HACK" } });
  t("updateMany su contatto altrui non tocca nulla", upd.count === 0);
  let updBlocked = false;
  try { await mine.contact.update({ where: { id: cHidden.id }, data: { firstName: "HACK" } }); } catch { updBlocked = true; }
  t("update su contatto altrui respinto", updBlocked);
  const created = await mine.contact.create({ data: { companyId: COMPANY, firstName: "Nuovo", email: `${TAG}-new@example.com` } });
  t("il contatto creato da chi vede solo i suoi gli viene assegnato", created.ownerUserId === ME);

  // ─── CRM collegato ────────────────────────────────────────────────────────
  const opps = new Set((await mine.opportunity.findMany({ where: { name: { startsWith: TAG } }, select: { id: true } })).map(o => o.id));
  t("opportunita' di cui e' owner visibile anche su contatto altrui", opps.has(oppMineOnHidden.id));
  t("opportunita' altrui su contatto altrui NON visibile", !opps.has(oppHidden.id));
  const tasks = new Set((await mine.task.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } })).map(x => x.id));
  t("task assegnato a lui visibile", tasks.has(taskAssigned.id));
  t("task altrui NON visibile", !tasks.has(taskHidden.id));

  // ─── fatturazione ─────────────────────────────────────────────────────────
  const clients = new Set((await mine.client.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } })).map(c => c.id));
  t("cliente del suo contatto visibile", clients.has(clMine.id));
  t("cliente di altri NON visibile", !clients.has(clHidden.id));
  const invs = new Set((await mine.invoice.findMany({ where: { number: { startsWith: TAG } }, select: { id: true } })).map(i => i.id));
  t("fattura del suo cliente visibile", invs.has(invMine.id));
  t("fattura di altri NON visibile", !invs.has(invHidden.id));
  t("pagamento di altri NON visibile", (await mine.payment.findUnique({ where: { id: payHidden.id } })) === null);
  const agg = await mine.invoice.aggregate({ where: { number: { startsWith: TAG } }, _sum: { amount: true } });
  t("aggregate limitato ai suoi dati", agg._sum.amount === 10, `somma=${agg._sum.amount}`);
  t("note di credito: filtro su relazione opzionale valido", Array.isArray(await mine.creditNote.findMany({ take: 1 })));

  // ─── senza limiti ─────────────────────────────────────────────────────────
  t("client senza visibilita' vede tutto", (await admin.contact.count({ where: { email: { startsWith: TAG } } })) === 4);
  const partial = companyDb(COMPANY, { userId: ME, own: new Set<AppSection>(["CONTACTS"]) });
  t("limite solo su CONTACTS: le fatture restano tutte visibili", (await partial.invoice.count({ where: { number: { startsWith: TAG } } })) === 2);
} finally {
  await admin.task.deleteMany({ where: { title: { startsWith: TAG } } });
  await admin.payment.deleteMany({ where: { id: payHidden.id } });
  await admin.invoice.deleteMany({ where: { number: { startsWith: TAG } } });
  await admin.client.deleteMany({ where: { email: { startsWith: TAG } } });
  await admin.opportunity.deleteMany({ where: { name: { startsWith: TAG } } });
  await admin.contact.deleteMany({ where: { email: { startsWith: TAG } } });
}

console.log(`\n${pass} passati, ${fail} falliti`);
await basePrisma.$disconnect();
process.exit(fail ? 1 : 0);
