import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireCompanyFromRequest, type CompanyContext } from "@/lib/company";
import { nextInvoiceNumber } from "@/lib/numbering";
import { Resend } from "resend";
import { renderToBuffer } from "@react-pdf/renderer";
import InvoicePDF from "@/lib/pdf/InvoicePDF";
import React from "react";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(companyName: string) {
  return `Sei l'assistente AI di ${companyName} per la creazione delle fatture. Parli sempre in italiano.

Il tuo flusso di lavoro:
1. Raccogli le informazioni: cliente, descrizione servizi, importi, aliquota IVA, date
2. Usa search_clients per trovare il cliente nel database
3. Usa get_company_info e get_next_invoice_number per completare i dati
4. Mostra un riepilogo chiaro e ben formattato (vedi formato sotto)
5. Aspetta conferma esplicita (l'utente scrive "ok", "sì", "confermo", "vai", "procedi" o simili)
6. Solo dopo conferma: chiama create_and_send_invoice

Formato riepilogo fattura:
---
📋 **RIEPILOGO FATTURA**

**Fornitore:** [nome azienda]
**Cliente:** [nome cliente / azienda]
**Email cliente:** [email]

**N° fattura:** [numero]
**Data emissione:** [data in formato DD/MM/YYYY]
**Scadenza:** [data in formato DD/MM/YYYY]

| Descrizione | Qtà | Prezzo unit. | Importo |
|-------------|-----|-------------|---------|
| [voce 1]    | [q] | €[prezzo]   | €[tot]  |

**Imponibile:** €X.XXX,XX
**IVA [%]%:** €XXX,XX
**Totale fattura:** €X.XXX,XX

Confermi? Rispondi **ok** per creare e inviare la fattura.
---

Regole importanti:
- NON creare la fattura senza conferma esplicita dell'utente
- Se il cliente non è trovato, descrivi i risultati trovati e chiedi conferma o chiarimenti
- La valuta è sempre EUR
- Se la scadenza non è specificata, usa 30 giorni dalla data di emissione e comunicalo
- Sii conciso ma completo. Niente testo inutile.
- Dopo aver creato la fattura, comunica il numero e che l'email è stata inviata
- Puoi creare fatture con stato PAID se l'utente dice che è già stata pagata. In quel caso chiedi la data di pagamento e NON inviare l'email (o inviala solo se richiesto esplicitamente)`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_clients",
    description: "Cerca clienti nel database per nome, email o azienda.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Testo di ricerca" } },
      required: ["query"],
    },
  },
  {
    name: "search_products",
    description: "Cerca prodotti o servizi nel catalogo.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_company_info",
    description: "Ottieni le informazioni aziendali (nome, indirizzo, P.IVA) per la fattura.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_next_invoice_number",
    description: "Ottieni il prossimo numero di fattura disponibile.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "create_and_send_invoice",
    description: "Crea la fattura nel database e invia l'email al cliente. Usare SOLO dopo conferma esplicita dell'utente.",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "ID del cliente" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unitPrice: { type: "number" },
              vatRate: { type: "number", description: "Percentuale IVA es. 22" },
            },
            required: ["description", "quantity", "unitPrice", "vatRate"],
          },
        },
        issueDate: { type: "string", description: "Data emissione ISO (YYYY-MM-DD)" },
        dueDate: { type: "string", description: "Data scadenza ISO (YYYY-MM-DD)" },
        notes: { type: "string", description: "Note opzionali" },
        status: { type: "string", enum: ["DRAFT", "SENT", "PAID"], description: "Stato fattura. Default SENT. Usa PAID se l'utente dice che è già stata pagata." },
        paidAt: { type: "string", description: "Data pagamento ISO (YYYY-MM-DD), obbligatoria se status è PAID" },
      },
      required: ["clientId", "lineItems", "issueDate", "dueDate"],
    },
  },
];

async function executeTool(ctx: CompanyContext, name: string, input: Record<string, unknown>): Promise<unknown> {
  const { db, company, companyId } = ctx;
  try {
  switch (name) {
    case "search_clients": {
      const q = String(input.query ?? "");
      const clients = await db.client.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, company: true, city: true, vatNumber: true },
        take: 5,
      });
      return clients;
    }

    case "search_products": {
      const q = String(input.query ?? "");
      const products = await db.product.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, description: true, basePrice: true, type: true },
        take: 5,
      });
      return products;
    }

    case "get_company_info": {
      return company;
    }

    case "get_next_invoice_number": {
      return { number: await nextInvoiceNumber(db, company.invoicePrefix, company.numberPadding) };
    }

    case "create_and_send_invoice": {
      const clientId = String(input.clientId);
      const lineItemsRaw = input.lineItems as Array<{ description: string; quantity: number; unitPrice: number; vatRate: number }>;
      const issueDate = new Date(String(input.issueDate));
      const dueDate = new Date(String(input.dueDate));
      const notes = input.notes ? String(input.notes) : undefined;
      const invoiceStatus = (input.status as "DRAFT" | "SENT" | "PAID") ?? "SENT";
      const paidAt = input.paidAt ? new Date(String(input.paidAt)) : (invoiceStatus === "PAID" ? new Date() : undefined);

      const number = await nextInvoiceNumber(db, company.invoicePrefix, company.numberPadding, issueDate.getFullYear());

      const amount = lineItemsRaw.reduce((s, li) => s + li.quantity * li.unitPrice, 0);

      const invoice = await db.invoice.create({
        data: {
          companyId,
          number,
          clientId,
          amount,
          currency: "EUR",
          issueDate,
          dueDate,
          notes,
          lineItems: lineItemsRaw,
          status: invoiceStatus,
          paidAt: paidAt ?? null,
          sentAt: invoiceStatus === "SENT" || invoiceStatus === "PAID" ? new Date() : null,
        },
        include: { client: true },
      });

      // Send email only for SENT status (not for PAID — already collected)
      let emailSent = false;
      let emailError: string | undefined;
      if (invoiceStatus === "PAID") {
        return { ok: true, invoiceId: invoice.id, number, emailSent: false, note: "Fattura registrata come pagata, email non inviata." };
      }
      try {
        const lineItems = lineItemsRaw.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.quantity * li.unitPrice,
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
            name: company.name, email: company.email, phone: company.phone,
            website: company.website, vatNumber: company.vatNumber, fiscalCode: company.fiscalCode,
            address: company.address, city: company.city, zip: company.zip,
            province: company.province, country: company.country,
            bankName: company.bankName, iban: company.iban, bic: company.bic,
            invoiceFooter: company.invoiceFooter,
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        const pdfBuffer = await renderToBuffer(element);
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromName = company.name;
        const fromEmail = company.emailFromAddress ?? process.env.EMAIL_FROM ?? "";
        const replyTo = company.emailReplyTo ?? process.env.EMAIL_REPLY_TO ?? "";
        const dueDateFmt = new Intl.DateTimeFormat("it-IT").format(invoice.dueDate);
        const amountFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(invoice.amount);

        if (invoice.client.email) {
          const { error } = await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            replyTo,
            to: [invoice.client.email],
            subject: `Fattura ${invoice.number} — ${amountFmt}`,
            html: `<p>Gentile ${invoice.client.name},<br>ti inviamo la fattura <strong>${invoice.number}</strong> di <strong>${amountFmt}</strong>, con scadenza il <strong>${dueDateFmt}</strong>.</p><p>Grazie,<br><strong>${fromName}</strong></p>`,
            attachments: [{ filename: `${invoice.number}.pdf`, content: Buffer.from(pdfBuffer).toString("base64") }],
          });
          if (error) { emailError = error.message; } else {
            emailSent = true;
            await db.invoice.update({ where: { id: invoice.id }, data: { status: "SENT", sentAt: new Date() } });
          }
        } else {
          emailError = "Il cliente non ha un indirizzo email";
        }
      } catch (emailErr) {
        emailError = String(emailErr);
        console.error("AI invoice email error:", emailErr);
      }

      return { ok: true, invoiceId: invoice.id, number, emailSent, emailError };
    }

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return { error: `Errore nell'esecuzione di ${name}: ${String(err)}` };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanyFromRequest(req);
  if ("response" in auth) return auth.response;
  const ctx = auth.ctx;

  try {
    const { messages } = await req.json() as { messages: Anthropic.MessageParam[] };

    let currentMessages: Anthropic.MessageParam[] = messages;
    const system = buildSystemPrompt(ctx.company.name);

    // Agent loop — runs until end_turn (max 8 rounds to prevent infinite loops)
    for (let i = 0; i < 8; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system,
        messages: currentMessages,
        tools: TOOLS,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content.find(b => b.type === "text")?.text ?? "";
        return NextResponse.json({ role: "assistant", content: text });
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: response.content },
        ];

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (b) => {
            const result = await executeTool(ctx, b.name, b.input as Record<string, unknown>);
            return {
              type: "tool_result" as const,
              tool_use_id: b.id,
              content: JSON.stringify(result),
            };
          })
        );

        currentMessages = [
          ...currentMessages,
          { role: "user", content: toolResults },
        ];
        continue;
      }

      break;
    }

    return NextResponse.json({ role: "assistant", content: "Mi dispiace, si è verificato un errore. Riprova." });
  } catch (e: unknown) {
    console.error("AI Invoice error:", e);
    return NextResponse.json({ role: "assistant", content: "Errore interno. Riprova tra qualche secondo." }, { status: 500 });
  }
}
