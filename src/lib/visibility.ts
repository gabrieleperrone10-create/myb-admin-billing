import type { AppSection } from "@prisma/client";

/**
 * Visibilita' "Solo assegnati" (DataScope OWN) — modulo puro.
 *
 * Un ruolo puo' limitare una sezione ai soli dati assegnati all'utente. Il
 * filtro si applica nel client database (lib/db.ts), quindi vale ovunque:
 * liste, schede, ricerca, export, report, dashboard, badge. Non dipende dal
 * fatto che ogni pagina si ricordi di filtrare.
 *
 * Il perno e' il CONTATTO: e' "mio" se ne sono il responsabile
 * (Contact.ownerUserId) o un assegnatario (ContactAssignee). Tutto cio' che e'
 * legato a un contatto mio e' visibile (cronologia, messaggi, note, form,
 * opportunita', task, appuntamenti, cliente di fatturazione, contratti,
 * fatture, pagamenti). In piu' restano visibili le opportunita' di cui sono
 * owner, i task che mi sono assegnati o che ho creato e gli appuntamenti in
 * cui sono host, anche su contatti non miei.
 */

export type Visibility = {
  userId: string;
  /** Sezioni in cui l'utente vede solo i dati assegnati */
  own: ReadonlySet<AppSection>;
};

type Where = Record<string, unknown>;

export function contactVisible(userId: string): Where {
  return { OR: [{ ownerUserId: userId }, { assignees: { some: { userId } } }] };
}

function opportunityVisible(userId: string): Where {
  return { OR: [{ ownerUserId: userId }, { contact: contactVisible(userId) }] };
}

function clientVisible(userId: string): Where {
  return { contact: contactVisible(userId) };
}

/**
 * Modello Prisma -> sezione che ne governa la visibilita' e filtro da applicare.
 * I figli diretti del contatto seguono la sezione CONTACTS.
 */
const RULES: Record<string, { section: AppSection; filter: (u: string) => Where }> = {
  Contact:                { section: "CONTACTS", filter: contactVisible },
  ContactTag:             { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  ContactAssignee:        { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  Note:                   { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  Activity:               { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  FormSubmission:         { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  PageView:               { section: "CONTACTS", filter: u => ({ contact: contactVisible(u) }) },
  Message:                { section: "CONVERSATIONS", filter: u => ({ contact: contactVisible(u) }) },
  Opportunity:            { section: "PIPELINES", filter: opportunityVisible },
  OpportunityStageChange: { section: "PIPELINES", filter: u => ({ opportunity: opportunityVisible(u) }) },
  Task:                   { section: "TASKS", filter: u => ({ OR: [{ assigneeUserId: u }, { createdByUserId: u }, { contact: contactVisible(u) }] }) },
  Appointment:            { section: "CALENDARS", filter: u => ({ OR: [{ hostUserId: u }, { contact: contactVisible(u) }] }) },
  Client:                 { section: "CLIENTS", filter: clientVisible },
  Contract:               { section: "CONTRACTS", filter: u => ({ client: clientVisible(u) }) },
  Deposit:                { section: "DEPOSITS", filter: u => ({ contract: { client: clientVisible(u) } }) },
  Invoice:                { section: "INVOICES", filter: u => ({ client: clientVisible(u) }) },
  CreditNote:             { section: "CREDIT_NOTES", filter: u => ({ client: clientVisible(u) }) },
  Payment:                {
    section: "PAYMENTS",
    filter: u => ({ OR: [{ invoice: { client: clientVisible(u) } }, { deposit: { contract: { client: clientVisible(u) } } }] }),
  },
};

/** Sezioni per cui ha senso "Solo assegnati" (per l'editor dei ruoli). */
export const SCOPABLE_SECTIONS: ReadonlySet<AppSection> = new Set(Object.values(RULES).map(r => r.section));

/** Filtro di visibilita' per un modello, o null se non limitato. */
export function visibilityFilter(model: string, vis: Visibility | undefined): Where | null {
  if (!vis || vis.own.size === 0) return null;
  const rule = RULES[model];
  if (!rule || !vis.own.has(rule.section)) return null;
  return rule.filter(vis.userId);
}

/** Aggiunge un filtro in AND lasciando i campi di primo livello (serve a findUnique). */
export function andWhere(where: Where, extra: Where): Where {
  const prev = where.AND;
  const list = Array.isArray(prev) ? prev : prev ? [prev] : [];
  return { ...where, AND: [...list, extra] };
}
