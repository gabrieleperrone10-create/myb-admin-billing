/**
 * Props comuni a tutte le tab della scheda contatto.
 * Ogni tab e' un Server Component asincrono che carica i propri dati con
 * requireCompany(slug): la pagina non passa dati, cosi' ogni tab resta
 * indipendente (e ognuna e' di proprieta' di un'area diversa del CRM).
 */
export type ContactTabProps = {
  slug: string;
  contactId: string;
};
