import "server-only";

/**
 * Numerazione documenti — unica implementazione, per azienda, atomica.
 *
 * Sostituisce le 6 copie divergenti che c'erano prima (actions/invoices.ts,
 * actions/contracts.ts, api/cron/generate-invoices, actions/creditNotes.ts e le
 * due varianti in api/invoices/ai) e la prima versione consolidata, che restava
 * read-then-write (leggeva il massimo esistente e lo incrementava in memoria):
 * sotto due richieste concorrenti sulla stessa azienda poteva produrre lo stesso
 * numero due volte, con solo l'indice unique su `number` a impedire il duplicato
 * (con un 500, non con un numero corretto).
 *
 * Qui l'incremento passa da `DocumentCounter`, una riga per (azienda, tipo,
 * anno), con un `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` — che in
 * Postgres prende un row lock sulla riga del contatore: i chiamanti concorrenti
 * si serializzano e ricevono valori distinti, in un solo round trip.
 *
 * Va chiamata DENTRO la stessa transazione della create del documento: se la
 * create fallisce, il rollback annulla anche l'incremento del contatore.
 */

/** Tipo strutturale: basta $queryRaw, cosi' funziona sia col client base sia con
 *  quello scoped da companyDb() (l'estensione comunque non intercetta $queryRaw) sia
 *  con un Prisma.TransactionClient. */
type Db = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

function format(prefix: string, year: number, sequence: number, padding: number) {
  return `${prefix}-${year}-${String(sequence).padStart(padding, "0")}`;
}

async function nextSequence(
  db: Db,
  companyId: string,
  kind: "INVOICE" | "CREDIT_NOTE",
  year: number,
): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentCounter" ("companyId", "kind", "year", "lastValue")
    VALUES (${companyId}, ${kind}::"DocumentKind", ${year}, 1)
    ON CONFLICT ("companyId", "kind", "year")
    DO UPDATE SET "lastValue" = "DocumentCounter"."lastValue" + 1
    RETURNING "lastValue"
  `;
  return rows[0].lastValue;
}

export async function nextInvoiceNumber(
  db: Db,
  companyId: string,
  prefix: string,
  padding: number,
  year = new Date().getFullYear(),
): Promise<string> {
  const seq = await nextSequence(db, companyId, "INVOICE", year);
  return format(prefix, year, seq, padding);
}

export async function nextCreditNoteNumber(
  db: Db,
  companyId: string,
  prefix: string,
  padding: number,
  year = new Date().getFullYear(),
): Promise<string> {
  const seq = await nextSequence(db, companyId, "CREDIT_NOTE", year);
  return format(prefix, year, seq, padding);
}
