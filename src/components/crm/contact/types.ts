/**
 * Props comuni a tutte le tab della scheda contatto.
 * Ogni tab e' un Server Component asincrono che carica i propri dati con
 * requireCompany(slug): la pagina non passa dati, cosi' ogni tab resta
 * indipendente (e ognuna e' di proprieta' di un'area diversa del CRM).
 *
 * `searchParams` e' opzionale e pass-through dalla pagina (?tab=...&...):
 * lo usano le tab che hanno bisogno di filtri/paginazione nell'URL (es.
 * Attivita'). Le altre tab lo ignorano semplicemente.
 */
export type ContactTabProps = {
  slug: string;
  contactId: string;
  searchParams?: Record<string, string | string[] | undefined>;
};
