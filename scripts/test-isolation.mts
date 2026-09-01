import { companyDb, basePrisma } from "../src/lib/db.js";

const real = companyDb("singleton");
const fake = companyDb("azienda-inesistente");
let pass = 0, fail = 0;
const t = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FALLITO"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

// 1. conteggi
const nReal = await real.invoice.count();
const nFake = await fake.invoice.count();
t("count filtrato sull'azienda vera", nReal === 254, `${nReal} fatture`);
t("count su azienda inesistente = 0", nFake === 0, `${nFake} fatture`);

// 2. findUnique per id — il test chiave: un id valido NON deve essere leggibile
//    da un client filtrato su un'altra azienda
const one = await real.invoice.findFirst({ select: { id: true, number: true } });
const viaReal = await real.invoice.findUnique({ where: { id: one!.id } });
const viaFake = await fake.invoice.findUnique({ where: { id: one!.id } });
t("findUnique visibile alla propria azienda", viaReal !== null, one!.number);
t("findUnique INVISIBILE ad altra azienda", viaFake === null, viaFake ? "!!! FUGA DI DATI" : "null");

// 3. update cross-azienda non deve toccare nulla
try {
  await fake.invoice.update({ where: { id: one!.id }, data: { notes: "HACKED" } });
  t("update cross-azienda respinto", false, "l'update e' passato!");
} catch {
  const after = await real.invoice.findUnique({ where: { id: one!.id }, select: { notes: true } });
  t("update cross-azienda respinto", after?.notes !== "HACKED", "record intatto");
}

// 4. aggregate e groupBy
const agg = await fake.payment.aggregate({ _sum: { amount: true } });
t("aggregate filtrato", agg._sum.amount === null, `somma=${agg._sum.amount}`);
const grp = await real.invoice.groupBy({ by: ["status"], _count: true });
t("groupBy funziona sull'azienda vera", grp.length > 0, `${grp.length} stati`);

// 5. scrittura con companyId di un'altra azienda deve essere bloccata
try {
  await real.expense.create({ data: {
    companyId: "un-altra-azienda", date: new Date(), category: "OTHER",
    description: "test", amount: 1 } });
  t("create con companyId altrui bloccato", false, "la create e' passata!");
} catch (e) {
  t("create con companyId altrui bloccato", String(e).includes("[db]"), "eccezione [db]");
}

// 6. modello non-tenant resta globale
const migrations = await basePrisma.$queryRaw<{c: bigint}[]>`select count(*)::int as c from "_prisma_migrations"`;
t("client base non filtrato ancora utilizzabile", Number(migrations[0].c) === 7, `${migrations[0].c} migration`);

console.log(`\n${pass} passati, ${fail} falliti`);
await basePrisma.$disconnect();
process.exit(fail ? 1 : 0);
