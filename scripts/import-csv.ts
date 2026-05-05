import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAmount(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parseDate(s: string): Date | null {
  if (!s || s.trim() === "" || s.includes("#")) return null;
  const parts = s.trim().split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y || y < 2000) return null;
  return new Date(y, m - 1, d);
}

function cleanPhone(s: string): string {
  return s ? s.replace(/\s+/g, "").trim() : "";
}

function cleanVat(s: string): string {
  if (!s) return "";
  // "15860261005 / GNTMCL91M14H501K" → "15860261005"
  return s.split("/")[0].replace(/\*/g, "").trim();
}

function mapProductType(programma: string) {
  const p = programma.toLowerCase();
  if (p.includes("consulenza")) return "CONSULTING" as const;
  if (p.includes("marketing")) return "SUBSCRIPTION" as const;
  return "COACHING" as const;
}

function mapStatus(stato: string, statoPagamento: string, dataPagata: string) {
  const hasPaidDate = !!parseDate(dataPagata);
  const isPaid =
    hasPaidDate &&
    (stato === "Saldata" ||
      stato === "Saldata in ritardo" ||
      stato === "Rata finale" ||
      statoPagamento === "Pagata");
  if (isPaid) return "PAID" as const;
  if (stato === "Insoluto" || stato === "da Saldare") return "OVERDUE" as const;
  return "SENT" as const;
}

function mapPaymentMethod(modalita: string) {
  const m = (modalita || "").toLowerCase();
  if (m.includes("stripe")) return "STRIPE" as const;
  if (m.includes("paypal")) return "PAYPAL" as const;
  return "BANK_TRANSFER" as const;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = path.resolve(
    process.argv[2] ||
      "/Users/gabrieleperrone/Downloads/Final - Tracking Clienti & Pagamenti - Chiusure.csv"
  );

  console.log(`\n📂 Lettura file: ${csvPath}\n`);
  const raw = fs.readFileSync(csvPath, "utf-8");

  const rows = parse(raw, {
    // Rinomina le colonne duplicate: la seconda "Stato" (col 34) diventa "Paese"
    columns: (header: string[]) =>
      header.map((h, i) => {
        if (h === "Stato" && i > 25) return "Paese";
        if (h === "") return `_col${i}`;
        return h;
      }),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  console.log(`📊 Righe trovate: ${rows.length}\n`);

  const stats = { clients: 0, products: 0, invoices: 0, payments: 0, skipped: 0 };
  const errors: string[] = [];

  // ── 1. Prodotti unici ─────────────────────────────────────────────────────
  const programmiUnici = [...new Set(rows.map((r) => r["Programma"]).filter(Boolean))];
  const productMap = new Map<string, string>(); // name → id

  for (const nome of programmiUnici) {
    const existing = await prisma.product.findFirst({ where: { name: nome } });
    if (existing) {
      productMap.set(nome, existing.id);
    } else {
      const p = await prisma.product.create({
        data: {
          name: nome,
          type: mapProductType(nome),
          basePrice: 0,
          active: true,
        },
      });
      productMap.set(nome, p.id);
      stats.products++;
      console.log(`  ✅ Prodotto creato: ${nome}`);
    }
  }

  // ── 2. Clienti unici ──────────────────────────────────────────────────────
  const clientMap = new Map<string, string>(); // email → id
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const email = (row["Email"] || "").toLowerCase().trim();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);

    const vatRaw = row["P.IVA"] || "";
    const countryVal = (row["Paese"] || "").replace(/#.*/g, "").trim();

    const existing = await prisma.client.findUnique({ where: { email } });
    if (existing) {
      clientMap.set(email, existing.id);
    } else {
      try {
        const c = await prisma.client.create({
          data: {
            name: (row["Nome e Cognome"] || "").trim(),
            email,
            phone: cleanPhone(row["Telefono"]) || null,
            company: (row["Ragione sociale"] || "").trim() || null,
            address: (row["Indirizzo"] || "").trim() || null,
            zip: (row["CAP"] || "").trim() || null,
            city: (row["Città"] || "").trim() || null,
            province: (row["Provincia"] || "").trim() || null,
            vatNumber: cleanVat(vatRaw) || null,
            country: countryVal || null,
          },
        });
        clientMap.set(email, c.id);
        stats.clients++;
      } catch (e) {
        errors.push(`Cliente ${email}: ${e}`);
      }
    }
  }

  // ── 3. Fatture + Pagamenti ────────────────────────────────────────────────
  const invoiceNumbersSeen = new Map<string, number>(); // per gestire duplicati

  for (const row of rows) {
    const email = (row["Email"] || "").toLowerCase().trim();
    const clientId = clientMap.get(email);
    if (!clientId) { stats.skipped++; continue; }

    const programma = (row["Programma"] || "").trim();
    const productId = productMap.get(programma);
    if (!productId) { stats.skipped++; continue; }

    const amount = parseAmount(row["Importo da pagare"]);
    if (!amount) { stats.skipped++; continue; }

    const issueDate = parseDate(row["Data"]) || new Date();
    const dueDate = parseDate(row["Data Prossima Rata"]) ||
      new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stato = (row["Stato"] || "").trim();
    const statoPagamento = (row["Stato della fattura"] || "").trim();
    const dataPagata = (row["Data Rata Saldata"] || "").trim();
    const status = mapStatus(stato, statoPagamento, dataPagata);
    const paidAt = status === "PAID" ? parseDate(dataPagata) : null;

    // Numero fattura
    let numBase = (row["Numero Fattura"] || "").trim();
    if (!numBase || numBase.toLowerCase() === "stripe") {
      numBase = `IMPORT-${issueDate.getFullYear()}-${email.slice(0, 4).toUpperCase()}`;
    }
    const numKey = `MYB-${numBase}`;
    const occurrences = invoiceNumbersSeen.get(numKey) || 0;
    invoiceNumbersSeen.set(numKey, occurrences + 1);
    const finalNumber = occurrences === 0 ? numKey : `${numKey}-${occurrences + 1}`;

    const note = (row["Note"] || "").trim() || null;
    const numeroRata = (row["Numero Rata"] || "").trim();

    try {
      const invoice = await prisma.invoice.create({
        data: {
          number: finalNumber,
          clientId,
          amount,
          status,
          issueDate,
          dueDate,
          paidAt,
          notes: [numeroRata, note].filter(Boolean).join(" — ") || null,
          lineItems: [{ description: programma, quantity: 1, unitPrice: amount, total: amount }],
        },
      });
      stats.invoices++;

      // Pagamento
      if (status === "PAID" && paidAt) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount,
            method: mapPaymentMethod(row["Modalità di Pagamento"]),
            paidAt,
            notes: numeroRata || null,
          },
        });
        stats.payments++;
      }
    } catch (e) {
      errors.push(`Fattura ${finalNumber} (${email}): ${e}`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════");
  console.log("  📈 IMPORT COMPLETATO");
  console.log("════════════════════════════════════════");
  console.log(`  ✅ Clienti creati:   ${stats.clients}`);
  console.log(`  ✅ Prodotti creati:  ${stats.products}`);
  console.log(`  ✅ Fatture create:   ${stats.invoices}`);
  console.log(`  ✅ Pagamenti creati: ${stats.payments}`);
  console.log(`  ⏭️  Righe saltate:   ${stats.skipped}`);
  if (errors.length) {
    console.log(`\n  ⚠️  Errori (${errors.length}):`);
    errors.slice(0, 20).forEach((e) => console.log(`    - ${e}`));
    if (errors.length > 20) console.log(`    ... e altri ${errors.length - 20}`);
  }
  console.log("════════════════════════════════════════\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
