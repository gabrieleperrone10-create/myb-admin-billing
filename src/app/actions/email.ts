"use server";

import { revalidatePath } from "next/cache";
import { companyAction } from "@/lib/companyAction";
import * as mail from "@/lib/mail";

/**
 * Wrapper sottili sulle uniche due funzioni di src/lib/mail.ts invocate
 * direttamente dal browser (SendEmailButton.tsx, SendCreditNoteEmailButton.tsx).
 *
 * mail.ts non verifica la membership — riceve solo un companyId e si fida di chi
 * lo chiama. Va bene per sendContractCreatedEmails/sendContractExpiringEmails,
 * usate solo da contesti gia' verificati (un'altra companyAction, il cron), ma
 * NON per queste due: un file "use server" e' un endpoint POST raggiungibile
 * anche se non importato altrove, quindi l'autorizzazione deve stare qui.
 */

export const sendInvoiceEmail = companyAction(async (ctx, invoiceId: string) => {
  const result = await mail.sendInvoiceEmail(ctx.companyId, invoiceId);
  if (result.ok) {
    revalidatePath(`/${ctx.slug}/invoices/${invoiceId}`);
    revalidatePath(`/${ctx.slug}/invoices`);
  }
  return result;
});

export const sendCreditNoteEmail = companyAction(async (ctx, creditNoteId: string) => {
  const result = await mail.sendCreditNoteEmail(ctx.companyId, creditNoteId);
  if (result.ok) {
    revalidatePath(`/${ctx.slug}/credit-notes/${creditNoteId}`);
    revalidatePath(`/${ctx.slug}/credit-notes`);
  }
  return result;
});
