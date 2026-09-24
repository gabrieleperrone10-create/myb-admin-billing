import type { Company } from "@prisma/client";

/**
 * Identita' email di un'azienda (modulo puro, senza DB: usa i campi gia'
 * caricati sulla riga Company).
 *
 * Invio: se l'azienda ha un dominio di invio VERIFICATO su Resend, si invia da
 * quel dominio (la parte locale di emailFromAddress se e' su quel dominio,
 * altrimenti "info@"). Altrimenti si mantiene il comportamento storico
 * (emailFromAddress / EMAIL_FROM), cosi' nulla cambia per chi non ha ancora
 * configurato un dominio.
 */
export function senderFor(company: Pick<Company, "emailFromName" | "emailFromAddress" | "emailReplyTo" | "emailDomain" | "emailDomainStatus">, displayName: string) {
  const fromName = company.emailFromName ?? displayName;
  const replyTo = company.emailReplyTo ?? process.env.EMAIL_REPLY_TO ?? "";

  if (company.emailDomain && company.emailDomainStatus === "verified") {
    const domain = company.emailDomain.toLowerCase();
    const current = company.emailFromAddress?.trim().toLowerCase() ?? "";
    const [local, host] = current.split("@");
    const fromEmail = host === domain && local ? current : `info@${domain}`;
    return { fromName, fromEmail, replyTo };
  }
  return { fromName, fromEmail: company.emailFromAddress ?? process.env.EMAIL_FROM ?? "", replyTo };
}

/** Dominio di ricezione della piattaforma (riserva condivisa). */
export function platformInboundDomain(): string | null {
  const d = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase();
  return d ? d : null;
}

/**
 * Dominio su cui ricevere le risposte ai messaggi del CRM per questa azienda:
 * il suo sottodominio verificato, altrimenti quello condiviso della
 * piattaforma, altrimenti null (risposte non tracciate).
 */
export function inboundDomainFor(company: Pick<Company, "inboundDomain" | "inboundDomainStatus">): string | null {
  if (company.inboundDomain && company.inboundDomainStatus === "verified") return company.inboundDomain.toLowerCase();
  return platformInboundDomain();
}

/** Domini su cui questa azienda puo' legittimamente ricevere risposte. */
export function acceptedInboundDomains(company: Pick<Company, "inboundDomain" | "inboundDomainStatus">): string[] {
  const out: string[] = [];
  if (company.inboundDomain && company.inboundDomainStatus === "verified") out.push(company.inboundDomain.toLowerCase());
  const p = platformInboundDomain();
  if (p) out.push(p);
  return out;
}

/** Normalizza e valida un dominio inserito dall'utente ("https://www.Axis.it/" -> "axis.it"). */
export function normalizeDomain(raw: string): string | null {
  let d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  d = d.replace(/\.$/, "");
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}
