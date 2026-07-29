"use server";

import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import CreditNotePDF from "@/lib/pdf/CreditNotePDF";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvoiceEmail(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  const [invoice, company] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!invoice) return { ok: false, error: "Fattura non trovata" };
  if (!invoice.client.email) return { ok: false, error: "Il cliente non ha un indirizzo email" };

  const rawItems = (invoice.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? li.qty ?? 1),
    unitPrice:   Number(li.unitPrice ?? li.price ?? 0),
    total:       Number(li.total ?? li.price ?? 0),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDF as any, {
    invoice: {
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      status: invoice.status,
      notes: invoice.notes,
      amount: invoice.amount,
      lineItems,
      client: {
        name: invoice.client.name,
        company: invoice.client.company,
        email: invoice.client.email,
        vatNumber: invoice.client.vatNumber,
        fiscalCode: invoice.client.fiscalCode,
        address: invoice.client.address,
        city: invoice.client.city,
        zip: invoice.client.zip,
        province: invoice.client.province,
        country: invoice.client.country,
      },
    },
    company: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      website: company.website,
      vatNumber: company.vatNumber,
      fiscalCode: company.fiscalCode,
      address: company.address,
      city: company.city,
      zip: company.zip,
      province: company.province,
      country: company.country,
      bankName: company.bankName,
      iban: company.iban,
      bic: company.bic,
      invoiceFooter: company.invoiceFooter,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const pdfBuffer = await renderToBuffer(element);

  const fromName = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";
  const isPaid = invoice.status === "PAID";
  const isOverdue = invoice.status === "OVERDUE";
  const dueDate = new Intl.DateTimeFormat("it-IT").format(new Date(invoice.dueDate));
  const paidDate = invoice.paidAt ? new Intl.DateTimeFormat("it-IT").format(new Date(invoice.paidAt)) : null;
  const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(invoice.amount);

  // Contenuto adattato allo stato della fattura
  const accentColor = isPaid ? "#16a34a" : isOverdue ? "#dc2626" : "#2563eb";
  const badgeText = isPaid ? "✅ PAGATA" : isOverdue ? "⚠️ SCADUTA" : "📄 DA PAGARE";
  const badgeBg = isPaid ? "#f0fdf4" : isOverdue ? "#fef2f2" : "#eff6ff";

  const bodyText = isPaid
    ? `ti confermiamo la ricezione del pagamento per la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong>${paidDate ? `, registrato in data <strong>${paidDate}</strong>` : ""}. Trovi il documento in allegato per i tuoi archivi.`
    : isOverdue
    ? `ti ricordiamo che la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong> risulta <strong>scaduta il ${dueDate}</strong> e non è ancora stata saldata. Ti chiediamo di provvedere al pagamento il prima possibile.`
    : `ti inviamo in allegato la fattura <strong>${invoice.number}</strong> di <strong>${amount}</strong>, con scadenza il <strong>${dueDate}</strong>. Ti chiediamo di procedere al pagamento entro la data indicata.`;

  const showBankDetails = !isPaid && company.iban;

  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 32px 16px;">

      <div style="border-bottom: 3px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 20px; font-weight: 700; color: ${accentColor};">${fromName}</span>
      </div>

      <div style="background: ${badgeBg}; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; display: inline-block;">
        <span style="font-size: 13px; font-weight: 600; color: ${accentColor};">${badgeText} — ${invoice.number}</span>
      </div>

      <p style="font-size: 16px; margin-bottom: 8px;">Gentile ${invoice.client.name},</p>
      <p style="color: #4b5563; line-height: 1.6;">${bodyText}</p>

      ${showBankDetails ? `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="font-size: 12px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px;">Coordinate bancarie per il pagamento</p>
        ${company.bankName ? `<p style="margin: 4px 0; font-size: 14px; color: #374151;">Banca: <strong>${company.bankName}</strong></p>` : ""}
        <p style="margin: 4px 0; font-size: 14px; color: #374151;">IBAN: <strong>${company.iban}</strong></p>
        ${company.bic ? `<p style="margin: 4px 0; font-size: 14px; color: #374151;">BIC/SWIFT: <strong>${company.bic}</strong></p>` : ""}
        <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Causale consigliata: ${invoice.number}</p>
      </div>
      ` : ""}

      <p style="color: #4b5563; line-height: 1.6; margin-top: 20px;">
        Per qualsiasi domanda o necessità di assistenza, rispondi direttamente a questa email
        o scrivici a <a href="mailto:${replyTo}" style="color: ${accentColor};">${replyTo}</a>.
      </p>

      <p style="color: #4b5563; margin-top: 20px;">Grazie,<br><strong>${fromName}</strong></p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 11px; color: #9ca3af;">
        ${company.email}${company.phone ? ` · ${company.phone}` : ""}${company.website ? ` · ${company.website}` : ""}
      </p>
    </body>
    </html>
  `;

  try {
    const subject = isPaid
      ? `Ricevuta pagamento ${invoice.number} — ${amount}`
      : isOverdue
      ? `⚠️ Sollecito pagamento ${invoice.number} — ${amount}`
      : `Fattura ${invoice.number} — ${amount}`;

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      replyTo: replyTo,
      to: [invoice.client.email],
      subject,
      html,
      attachments: [
        {
          filename: `${invoice.number}.pdf`,
          content: Buffer.from(pdfBuffer).toString("base64"),
        },
      ],
    });

    if (error) return { ok: false, error: error.message };

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: invoice.status === "DRAFT" ? "SENT" : invoice.status, sentAt: new Date() },
    });

    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function sendCreditNoteEmail(creditNoteId: string): Promise<{ ok: boolean; error?: string }> {
  const [creditNote, company] = await Promise.all([
    prisma.creditNote.findUnique({ where: { id: creditNoteId } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!creditNote) return { ok: false, error: "Nota di credito non trovata" };
  if (!creditNote.clientEmail) return { ok: false, error: "Il cliente non ha un indirizzo email" };

  const rawItems = (creditNote.lineItems ?? []) as Record<string, unknown>[];
  const lineItems = rawItems.map(li => ({
    description: String(li.description ?? ""),
    quantity:    Number(li.quantity ?? 1),
    unitPrice:   Number(li.unitPrice ?? 0),
    total:       Number(li.total ?? 0),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CreditNotePDF as any, {
    creditNote: {
      number: creditNote.number,
      issueDate: creditNote.issueDate,
      reason: creditNote.reason,
      notes: creditNote.notes,
      amount: creditNote.amount,
      currency: creditNote.currency,
      lineItems,
      originalInvoiceNumber: creditNote.originalInvoiceNumber,
      originalInvoiceDate: creditNote.originalInvoiceDate,
      client: {
        name: creditNote.clientName,
        company: creditNote.clientCompany,
        email: creditNote.clientEmail,
        vatNumber: creditNote.clientVatNumber,
        fiscalCode: creditNote.clientFiscalCode,
        address: creditNote.clientAddress,
        city: creditNote.clientCity,
        zip: creditNote.clientZip,
        province: creditNote.clientProvince,
        country: creditNote.clientCountry,
      },
    },
    company: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      website: company.website,
      vatNumber: company.vatNumber,
      fiscalCode: company.fiscalCode,
      address: company.address,
      city: company.city,
      zip: company.zip,
      province: company.province,
      country: company.country,
      invoiceFooter: company.invoiceFooter,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const pdfBuffer = await renderToBuffer(element);

  const fromName = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";
  const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: creditNote.currency }).format(creditNote.amount);

  const html = `
    <!DOCTYPE html>
    <html lang="it">
    <head><meta charset="utf-8"></head>
    <body style="font-family: sans-serif; color: #111827; max-width: 600px; margin: 0 auto; padding: 32px 16px;">

      <div style="border-bottom: 3px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 20px; font-weight: 700; color: #dc2626;">${fromName}</span>
      </div>

      <div style="background: #fef2f2; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; display: inline-block;">
        <span style="font-size: 13px; font-weight: 600; color: #dc2626;">📄 NOTA DI CREDITO — ${creditNote.number}</span>
      </div>

      <p style="font-size: 16px; margin-bottom: 8px;">Gentile ${creditNote.clientName},</p>
      <p style="color: #4b5563; line-height: 1.6;">
        ti inviamo in allegato la nota di credito <strong>${creditNote.number}</strong> di <strong>${amount}</strong>,
        relativa alla fattura <strong>${creditNote.originalInvoiceNumber}</strong>.
        ${creditNote.reason ? `<br><br>Motivo: ${creditNote.reason}` : ""}
      </p>

      <p style="color: #4b5563; line-height: 1.6; margin-top: 20px;">
        Per qualsiasi domanda o necessità di assistenza, rispondi direttamente a questa email
        o scrivici a <a href="mailto:${replyTo}" style="color: #dc2626;">${replyTo}</a>.
      </p>

      <p style="color: #4b5563; margin-top: 20px;">Grazie,<br><strong>${fromName}</strong></p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="font-size: 11px; color: #9ca3af;">
        ${company.email}${company.phone ? ` · ${company.phone}` : ""}${company.website ? ` · ${company.website}` : ""}
      </p>
    </body>
    </html>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      replyTo: replyTo,
      to: [creditNote.clientEmail],
      subject: `Nota di credito ${creditNote.number} — ${amount}`,
      html,
      attachments: [
        {
          filename: `${creditNote.number}.pdf`,
          content: Buffer.from(pdfBuffer).toString("base64"),
        },
      ],
    });

    if (error) return { ok: false, error: error.message };

    await prisma.creditNote.update({
      where: { id: creditNoteId },
      data: { status: "SENT", sentAt: new Date() },
    });

    revalidatePath(`/credit-notes/${creditNoteId}`);
    revalidatePath("/credit-notes");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  RECURRING: "Ricorrente",
  ONE_SHOT: "Una tantum",
  INSTALLMENT: "A rate",
};

const BILLING_PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "mensile",
  QUARTERLY: "trimestrale",
  ANNUALLY: "annuale",
};

export async function sendContractCreatedEmails(contractId: string): Promise<{ ok: boolean; error?: string }> {
  const [contract, company] = await Promise.all([
    prisma.contract.findUnique({ where: { id: contractId }, include: { client: true, product: true } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!contract) return { ok: false, error: "Contratto non trovato" };

  const fromName  = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo   = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";

  const amount      = new Intl.NumberFormat("it-IT", { style: "currency", currency: contract.currency }).format(contract.amount);
  const startDate   = new Intl.DateTimeFormat("it-IT").format(new Date(contract.startDate));
  const endDate     = contract.endDate ? new Intl.DateTimeFormat("it-IT").format(new Date(contract.endDate)) : null;
  const typeLabel   = CONTRACT_TYPE_LABEL[contract.type] || contract.type;
  const periodLabel = contract.type !== "ONE_SHOT" ? ` (fatturazione ${BILLING_PERIOD_LABEL[contract.billingPeriod] || contract.billingPeriod})` : "";

  const detailsRows = `
    <p style="margin:4px 0;font-size:14px;color:#374151;">Servizio: <strong>${contract.product.name}</strong></p>
    <p style="margin:4px 0;font-size:14px;color:#374151;">Tipo: <strong>${typeLabel}${periodLabel}</strong></p>
    <p style="margin:4px 0;font-size:14px;color:#374151;">Importo: <strong>${amount}</strong></p>
    <p style="margin:4px 0;font-size:14px;color:#374151;">Durata: <strong>dal ${startDate}${endDate ? ` al ${endDate}` : " (senza scadenza)"}</strong></p>
  `;

  let clientOk = true;
  let clientError: string | undefined;

  if (contract.client.email) {
    try {
      const html = `
        <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
          <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:#2563eb;">${fromName}</span>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:inline-block;">
            <span style="font-size:13px;font-weight:600;color:#2563eb;">✅ CONTRATTO ATTIVATO</span>
          </div>
          <p style="font-size:16px;margin-bottom:8px;">Gentile ${contract.client.name},</p>
          <p style="color:#4b5563;line-height:1.6;">
            grazie per aver scelto <strong>${fromName}</strong>! Ti confermiamo che il tuo contratto è stato attivato con successo.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="font-size:12px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Dettagli contratto</p>
            ${detailsRows}
          </div>
          <p style="color:#4b5563;line-height:1.6;">
            Per qualsiasi domanda siamo a disposizione — scrivici a <a href="mailto:${replyTo}" style="color:#2563eb;">${replyTo}</a>${company.phone ? ` o chiamaci al ${company.phone}` : ""}.
          </p>
          <p style="color:#4b5563;margin-top:20px;">Grazie ancora,<br><strong>${fromName}</strong></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:11px;color:#9ca3af;">${company.email}${company.phone ? ` · ${company.phone}` : ""}${company.website ? ` · ${company.website}` : ""}</p>
        </body></html>
      `;

      const { error } = await resend.emails.send({
        from:    `${fromName} <${fromEmail}>`,
        replyTo,
        to:      [contract.client.email],
        subject: `Il tuo contratto con ${fromName} è attivo — ${contract.product.name}`,
        html,
      });
      if (error) { clientOk = false; clientError = error.message; }
    } catch (e) {
      clientOk = false; clientError = String(e);
    }
  }

  // Email interna — non deve mai bloccare l'esito verso il cliente
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const html = `
      <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
      <body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
        <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
          <span style="font-size:20px;font-weight:700;color:#2563eb;">${fromName}</span>
        </div>
        <div style="background:#eff6ff;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:inline-block;">
          <span style="font-size:13px;font-weight:600;color:#2563eb;">🆕 NUOVO CONTRATTO</span>
        </div>
        <p style="font-size:16px;margin-bottom:8px;">Nuovo contratto creato per <strong>${contract.client.name}</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:24px 0;">
          ${detailsRows}
          <p style="margin:4px 0;font-size:14px;color:#374151;">Cliente: <strong>${contract.client.name}</strong>${contract.client.email ? ` — ${contract.client.email}` : ""}</p>
        </div>
        ${appUrl ? `<p style="color:#4b5563;"><a href="${appUrl}/contracts/${contract.id}" style="color:#2563eb;">Apri il contratto nel gestionale →</a></p>` : ""}
      </body></html>
    `;

    await resend.emails.send({
      from:    `${fromName} <${fromEmail}>`,
      replyTo,
      to:      [replyTo],
      subject: `Nuovo contratto: ${contract.client.name} — ${contract.product.name}`,
      html,
    });
  } catch {
    // non bloccare per il fallimento dell'email interna
  }

  return clientOk ? { ok: true } : { ok: false, error: clientError };
}

export async function sendContractExpiringEmails(contractId: string, daysUntil: 30 | 7 | 1 | 0): Promise<{ ok: boolean; error?: string }> {
  const [contract, company] = await Promise.all([
    prisma.contract.findUnique({ where: { id: contractId }, include: { client: true, product: true } }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  if (!contract || !contract.endDate) return { ok: false, error: "Contratto non trovato o senza scadenza" };

  const fromName   = company.name || "Market Your Business";
  const fromEmail  = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const replyTo    = process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";
  const endDateFmt = new Intl.DateTimeFormat("it-IT").format(new Date(contract.endDate));

  let badgeLabel: string, accentColor: string, badgeBg: string, subject: string, clientBody: string, internalUrgency: string;

  if (daysUntil === 30) {
    badgeLabel = "⏳ CONTRATTO IN SCADENZA";
    accentColor = "#2563eb"; badgeBg = "#eff6ff";
    subject = "Il tuo contratto scade tra 30 giorni";
    internalUrgency = "tra 30 giorni";
    clientBody = `
      ti scriviamo per informarti che il tuo contratto (<strong>${contract.product.name}</strong>) scadrà il
      <strong>${endDateFmt}</strong>, tra 30 giorni. Se hai domande o vuoi parlare del rinnovo, scrivici a
      <a href="mailto:${replyTo}" style="color:${accentColor};">${replyTo}</a> e/o contatta il tuo tutor di riferimento.
      In ogni caso, ti contatteremo noi nei prossimi giorni per parlarne insieme.
    `;
  } else if (daysUntil === 7) {
    badgeLabel = "⏳ PROMEMORIA SCADENZA";
    accentColor = "#2563eb"; badgeBg = "#eff6ff";
    subject = "Promemoria: il tuo contratto scade tra 7 giorni";
    internalUrgency = "tra 7 giorni";
    clientBody = `
      un piccolo promemoria: il tuo contratto (<strong>${contract.product.name}</strong>) scadrà il
      <strong>${endDateFmt}</strong>, tra una settimana. Se vuoi parlarne, siamo a disposizione a
      <a href="mailto:${replyTo}" style="color:${accentColor};">${replyTo}</a>.
    `;
  } else if (daysUntil === 1) {
    badgeLabel = "⚠️ CONTRATTO IN SCADENZA DOMANI";
    accentColor = "#c78b2a"; badgeBg = "#fffbeb";
    subject = "Il tuo contratto scade domani";
    internalUrgency = "domani";
    clientBody = `
      il tuo contratto (<strong>${contract.product.name}</strong>) scade <strong>domani, ${endDateFmt}</strong>.
      Se non ne abbiamo già parlato, scrivici quanto prima a
      <a href="mailto:${replyTo}" style="color:${accentColor};">${replyTo}</a> o contatta il tuo tutor di riferimento.
    `;
  } else {
    badgeLabel = "🔴 CONTRATTO SCADE OGGI";
    accentColor = "#dc2626"; badgeBg = "#fef2f2";
    subject = "Il tuo contratto scade oggi";
    internalUrgency = "oggi";
    clientBody = `
      oggi è l'ultimo giorno del tuo contratto (<strong>${contract.product.name}</strong>) con noi.
      Se vuoi continuare a lavorare insieme, contattaci il prima possibile a
      <a href="mailto:${replyTo}" style="color:${accentColor};">${replyTo}</a>.
    `;
  }

  let clientOk = true;
  let clientError: string | undefined;

  if (contract.client.email) {
    try {
      const html = `
        <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
          <div style="border-bottom:3px solid ${accentColor};padding-bottom:16px;margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;color:${accentColor};">${fromName}</span>
          </div>
          <div style="background:${badgeBg};border-radius:8px;padding:10px 16px;margin-bottom:20px;display:inline-block;">
            <span style="font-size:13px;font-weight:600;color:${accentColor};">${badgeLabel}</span>
          </div>
          <p style="font-size:16px;margin-bottom:8px;">Gentile ${contract.client.name},</p>
          <p style="color:#4b5563;line-height:1.6;">${clientBody}</p>
          <p style="color:#4b5563;margin-top:20px;">Grazie,<br><strong>${fromName}</strong></p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:11px;color:#9ca3af;">${company.email}${company.phone ? ` · ${company.phone}` : ""}${company.website ? ` · ${company.website}` : ""}</p>
        </body></html>
      `;

      const { error } = await resend.emails.send({
        from:    `${fromName} <${fromEmail}>`,
        replyTo,
        to:      [contract.client.email],
        subject,
        html,
      });
      if (error) { clientOk = false; clientError = error.message; }
    } catch (e) {
      clientOk = false; clientError = String(e);
    }
  }

  // Promemoria interno — non deve mai bloccare l'esito verso il cliente
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency: contract.currency }).format(contract.amount);
    const html = `
      <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
      <body style="font-family:sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:32px 16px;">
        <div style="border-bottom:3px solid ${accentColor};padding-bottom:16px;margin-bottom:24px;">
          <span style="font-size:20px;font-weight:700;color:${accentColor};">${fromName}</span>
        </div>
        <p style="font-size:16px;color:#111827;">
          Il contratto di <strong>${contract.client.name}</strong> (${contract.product.name}, ${amount}) scade
          <strong>${internalUrgency}</strong> (${endDateFmt}).
        </p>
        <p style="color:#4b5563;">Ricordati di contattarlo — al cliente abbiamo già scritto che lo faremo noi nei prossimi giorni.</p>
        ${appUrl ? `<p><a href="${appUrl}/contracts/${contract.id}" style="color:${accentColor};">Apri il contratto nel gestionale →</a></p>` : ""}
      </body></html>
    `;

    await resend.emails.send({
      from:    `${fromName} <${fromEmail}>`,
      replyTo,
      to:      [replyTo],
      subject: `[Contratto in scadenza ${internalUrgency}] ${contract.client.name}`,
      html,
    });
  } catch {
    // non bloccare per il fallimento dell'email interna
  }

  return clientOk ? { ok: true } : { ok: false, error: clientError };
}
