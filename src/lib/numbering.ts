import "server-only";

/**
 * Numerazione documenti — unica implementazione, per azienda.
 *
 * Sostituisce le 6 copie divergenti che c'erano prima (actions/invoices.ts,
 * actions/contracts.ts, api/cron/generate-invoices, actions/creditNotes.ts e le
 * due varianti in api/invoices/ai).
 *
 * Semantica preservata volutamente identica a quella dei percorsi di creazione
 * reali: il progressivo è il massimo trovato su TUTTI gli anni, formattato con
 * l'anno corrente. Non si azzera a gennaio. Le due varianti in api/invoices/ai
 * facevano invece un reset annuale con `orderBy: { number: "desc" }`
 * lessicografico (rotto oltre la sequenza 9999): erano in conflitto con il resto
 * e vengono allineate qui.
 *
 * NOTA: resta read-then-write, quindi non è sicura in concorrenza. L'unico
 * presidio è l'indice unique su `number`. Diventa atomica nella fase 4, con la
 * tabella DocumentCounter e un INSERT ... ON CONFLICT DO UPDATE RETURNING.
 */

/**
 * Tipo strutturale, non `PrismaClient`: cosi' accetta sia il client base sia quello
 * esteso da companyDb() sia una TransactionClient, senza dipendere dalla forma
 * esatta che $extends produce.
 */
type Reader = { findMany(args: { select: { number: true } }): Promise<{ number: string }[]> };
type Db = { invoice: Reader; creditNote: Reader };

function format(prefix: string, year: number, sequence: number, padding: number) {
  return `${prefix}-${year}-${String(sequence).padStart(padding, "0")}`;
}

function maxSequence(numbers: string[], prefix: string) {
  const re = new RegExp(`^${prefix}-\\d{4}-(\\d+)$`);
  let max = 0;
  for (const n of numbers) {
    const m = n.match(re);
    if (m) {
      const value = parseInt(m[1], 10);
      if (value > max) max = value;
    }
  }
  return max;
}

/**
 * Allocatore per la generazione in blocco: legge una sola volta e poi incrementa
 * in memoria. Serve al cron, che prima rifaceva una scansione completa della
 * tabella Invoice per ogni rata generata.
 */
export async function invoiceNumberAllocator(
  client: Db,
  year: number,
  prefix: string,
  padding: number,
): Promise<() => string> {
  const all = await client.invoice.findMany({ select: { number: true } });
  let seq = maxSequence(all.map(i => i.number), prefix);
  return () => format(prefix, year, ++seq, padding);
}

export async function nextInvoiceNumber(
  client: Db,
  prefix: string,
  padding: number,
  year = new Date().getFullYear(),
): Promise<string> {
  return (await invoiceNumberAllocator(client, year, prefix, padding))();
}

export async function nextCreditNoteNumber(
  client: Db,
  prefix: string,
  padding: number,
  year = new Date().getFullYear(),
): Promise<string> {
  const all = await client.creditNote.findMany({ select: { number: true } });
  return format(prefix, year, maxSequence(all.map(c => c.number), prefix) + 1, padding);
}
