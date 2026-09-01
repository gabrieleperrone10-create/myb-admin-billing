import "server-only";
import { requireCompany, type CompanyContext } from "@/lib/company";

/**
 * Avvolge una server action in modo che riceva un contesto azienda gia'
 * verificato, con lo slug come primo argomento.
 *
 *   export const createInvoice = companyAction(async (ctx, formData: FormData) => {
 *     await ctx.db.invoice.create({ data: { companyId: ctx.companyId, ... } });
 *     revalidatePath(`/${ctx.slug}/invoices`);
 *   });
 *
 *   // lato form:  <form action={createInvoice.bind(null, slug)}>
 *
 * Perche' lo slug come argomento e non altro:
 *
 *  - il *referer* e' falsificabile e non e' una fonte di autorizzazione;
 *  - un *cookie* sincronizzato con l'URL sembra comodo ma e' un bug di
 *    correttezza, non solo di sicurezza: con due schede aperte su aziende
 *    diverse il cookie contiene quella caricata per ultima, e una modifica
 *    fatta nella scheda A finisce nell'azienda B — con il controllo di
 *    membership che passa, perche' l'utente appartiene legittimamente a
 *    entrambe. Non e' risolvibile con un cookie.
 *
 * Next cifra gli argomenti legati con .bind() cosi' il browser non li legge, ma
 * la cifratura e' riservatezza, non autorizzazione: una POST costruita a mano
 * puo' comunque fornire un valore. Per questo requireCompany() rigira il
 * controllo di membership a ogni invocazione.
 *
 * Nessun try/catch qui dentro: redirect() e notFound() funzionano lanciando un
 * segnale di controllo (NEXT_REDIRECT / NEXT_HTTP_ERROR_FALLBACK) che deve
 * propagare. Intercettarlo li spegnerebbe in silenzio.
 */
export function companyAction<A extends unknown[], R>(
  fn: (ctx: CompanyContext, ...args: A) => Promise<R>,
) {
  return async (slug: string, ...args: A): Promise<R> => {
    const ctx = await requireCompany(slug);
    return fn(ctx, ...args);
  };
}
