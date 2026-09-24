/**
 * "Incassato" per contatto. Modulo PURO.
 *
 * REGOLA:
 *  - la base sono le FATTURE PAGATE (Invoice.status = PAID) dei Client collegati
 *    a un Contact (Client.contactId). Non si sommano i Payment a parte perche'
 *    l'acconto (Deposit) crea sia un Payment sia una fattura PAID "Acconto /
 *    deposito": sommarli entrambi conterebbe due volte lo stesso denaro, e alcune
 *    fatture PAID (agente AI, acconti) non hanno un Payment collegato;
 *  - importo = Payment.amount se la fattura ha un pagamento collegato (e' il
 *    denaro effettivamente arrivato), altrimenti Invoice.amount;
 *  - data = Payment.paidAt, altrimenti Invoice.paidAt, altrimenti issueDate;
 *  - i metodi in `excluded` non contano. Nei report di vendita Stripe CONTA di
 *    default (dipende dal funnel se e' incasso vero): lo si esclude col filtro
 *    "Includi pagamenti Stripe" (ReportScope.includeStripe). La dashboard
 *    finanziaria resta con la sua regola (Stripe = pass-through);
 *  - NOTE DI CREDITO: riducono l'incassato solo se collegate a una fattura che e'
 *    stata contata (una nota che storna una fattura mai pagata non restituisce
 *    denaro incassato). Stato CANCELLED ignorato. Lo storno di una fattura e'
 *    limitato al suo importo contato (l'incassato netto per fattura non va sotto
 *    zero). La nota si imputa alla sua data di emissione;
 *  - note di credito "manuali" senza fattura collegata non si sottraggono
 *    (riguardano fatture fuori dal gestionale, quindi mai contate).
 */

export const EXCLUDED_PAYMENT_METHODS: readonly string[] = ["STRIPE"];

export type PaidInvoiceRow = {
  id: string;
  contactId: string;
  amount: number;
  paidAt: Date | null;
  issueDate: Date;
  payment: { amount: number; method: string; paidAt: Date } | null;
};

export type CreditNoteRow = {
  invoiceId: string | null;
  amount: number;
  issueDate: Date;
};

export type CollectionEvent = { contactId: string; at: Date; amount: number };

export function collectionEvents(
  invoices: PaidInvoiceRow[],
  creditNotes: CreditNoteRow[],
  excluded: readonly string[] = EXCLUDED_PAYMENT_METHODS,
): CollectionEvent[] {
  const events: CollectionEvent[] = [];
  const counted = new Map<string, { contactId: string; remaining: number }>();

  for (const inv of invoices) {
    if (inv.payment && excluded.includes(inv.payment.method)) continue;
    const amount = inv.payment ? inv.payment.amount : inv.amount;
    if (!(amount > 0)) continue;
    const at = inv.payment?.paidAt ?? inv.paidAt ?? inv.issueDate;
    events.push({ contactId: inv.contactId, at, amount });
    counted.set(inv.id, { contactId: inv.contactId, remaining: amount });
  }

  const notes = [...creditNotes].sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime());
  for (const cn of notes) {
    if (!cn.invoiceId) continue;
    const c = counted.get(cn.invoiceId);
    if (!c || c.remaining <= 0 || !(cn.amount > 0)) continue;
    const sub = Math.min(cn.amount, c.remaining);
    c.remaining -= sub;
    events.push({ contactId: c.contactId, at: cn.issueDate, amount: -sub });
  }
  return events;
}

export function sumByContact(events: CollectionEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) m.set(e.contactId, (m.get(e.contactId) ?? 0) + e.amount);
  return m;
}
