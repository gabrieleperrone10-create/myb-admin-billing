import { createReadStream } from "fs";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// Read CSV
const raw = readFileSync("/Users/gabrieleperrone/Downloads/Final - Tracking Clienti & Pagamenti - Chiusure.csv", "utf8");
const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);

function parseAmount(s) {
  if (!s) return 0;
  return parseFloat(s.replace(/€\s*/g, "").replace(/\./g, "").replace(",", ".").trim()) || 0;
}

function parseDate(s) {
  if (!s || s.includes("#") || s.includes("xx") || s.includes("Non")) return null;
  const parts = s.trim().split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

function parseRow(line) {
  // CSV parse respecting quoted fields
  const cols = [];
  let inQuote = false, cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; }
    else if (c === "," && !inQuote) { cols.push(cur); cur = ""; }
    else { cur += c; }
  }
  cols.push(cur);
  return cols;
}

function paymentMethod(s) {
  if (!s) return "BANK_TRANSFER";
  const u = s.toUpperCase();
  if (u.includes("STRIPE")) return "STRIPE";
  if (u.includes("PAYPAL")) return "PAYPAL";
  return "BANK_TRANSFER";
}

function invoiceStatus(stato) {
  if (!stato) return "SENT";
  const s = stato.toLowerCase();
  if (s.includes("saldata") || s.includes("rata finale") || s.includes("pagata")) return "PAID";
  if (s.includes("insoluto")) return "OVERDUE";
  if (s.includes("standby") || s.includes("elabora")) return "DRAFT";
  return "SENT";
}

function sq(s) {
  if (!s) return "NULL";
  return "'" + String(s).replace(/'/g, "''").trim() + "'";
}

// Parse rows
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseRow(lines[i]);
  const data   = cols[0]?.trim();
  const fatNum = cols[1]?.trim();
  const prog   = cols[2]?.trim();
  const amount = parseAmount(cols[3]);
  const totale = parseAmount(cols[4]);
  const nome   = cols[5]?.trim();
  const email  = cols[6]?.trim();
  const phone  = cols[7]?.trim();
  const metodo = cols[15]?.trim();
  const stato  = cols[19]?.trim();
  const dataPagato = cols[22]?.trim();
  const ragSoc = cols[26]?.trim();
  const addr   = cols[27]?.trim();
  const cap    = cols[28]?.trim();
  const citta  = cols[29]?.trim();
  const prov   = cols[30]?.trim();
  const piva   = cols[31]?.trim();

  // Skip template row and empty rows
  if (!nome || nome === "Non toccare" || !email || email === "Non toccare") continue;
  if (!data || data.includes("#")) continue;

  rows.push({ data, fatNum, prog, amount, totale, nome, email, phone, metodo, stato, dataPagato, ragSoc, addr, cap, citta, prov, piva });
}

// ── Clients (unique by email) ──────────────────────────────────────────────
const clientMap = new Map(); // email → id
for (const r of rows) {
  const e = r.email.toLowerCase();
  if (!clientMap.has(e)) {
    clientMap.set(e, randomUUID());
  }
}

// ── Products (unique by name) ──────────────────────────────────────────────
const productMap = new Map(); // name → id
for (const r of rows) {
  if (!r.prog || r.prog === "Non toccare") continue;
  const key = r.prog.trim();
  if (!clientMap.has(key) && !productMap.has(key)) {
    productMap.set(key, randomUUID());
  }
}
// Ensure unique product names don't clash with client emails
for (const r of rows) {
  if (!r.prog || r.prog === "Non toccare") continue;
  const key = r.prog.trim();
  if (!productMap.has(key)) {
    productMap.set(key, randomUUID());
  }
}

// ── Contracts (unique by email+product) ────────────────────────────────────
const contractMap = new Map(); // email+"|"+prog → id
for (const r of rows) {
  if (!r.prog) continue;
  const key = r.email.toLowerCase() + "|" + r.prog.trim();
  if (!contractMap.has(key)) {
    contractMap.set(key, randomUUID());
  }
}

// ── Generate SQL ───────────────────────────────────────────────────────────
const out = [];

out.push("-- ============================================================");
out.push("-- MYB Import: Clients, Products, Contracts, Invoices, Payments");
out.push("-- ============================================================\n");

// Clients
out.push("-- CLIENTS");
const clientRows = new Map(); // email → row (first occurrence for address)
for (const r of rows) {
  const e = r.email.toLowerCase();
  if (!clientRows.has(e)) clientRows.set(e, r);
}
for (const [email, r] of clientRows) {
  const id = clientMap.get(email);
  const now = new Date().toISOString();
  out.push(
    `INSERT INTO "Client" (id, name, email, phone, company, "vatNumber", address, city, zip, province, "createdAt", "updatedAt") VALUES ` +
    `(${sq(id)}, ${sq(r.nome)}, ${sq(email)}, ${sq(r.phone||null)}, ${sq(r.ragSoc||null)}, ${sq(r.piva||null)}, ${sq(r.addr||null)}, ${sq(r.citta||null)}, ${sq(r.cap||null)}, ${sq(r.prov||null)}, '${now}', '${now}') ON CONFLICT (email) DO NOTHING;`
  );
}

out.push("\n-- PRODUCTS");
const PRODUCT_TYPE_MAP = {
  "consulting": "CONSULTING",
  "coaching": "COACHING",
  "subscription": "SUBSCRIPTION",
};
function guessType(name) {
  const n = name.toLowerCase();
  if (n.includes("coaching") || n.includes("masterclass") || n.includes("ticket") || n.includes("codice") || n.includes("scale") || n.includes("imprenditore") || n.includes("ai ")) return "COACHING";
  if (n.includes("consulenza") || n.includes("press") || n.includes("ecosistema")) return "CONSULTING";
  if (n.includes("marketing") || n.includes("ads") || n.includes("advertising")) return "CONSULTING";
  if (n.includes("gestione")) return "CONSULTING";
  return "DIGITAL";
}
for (const [name, id] of productMap) {
  const type = guessType(name);
  const now = new Date().toISOString();
  out.push(
    `INSERT INTO "Product" (id, name, type, "basePrice", active, "createdAt", "updatedAt") VALUES ` +
    `(${sq(id)}, ${sq(name)}, '${type}', 0, true, '${now}', '${now}') ON CONFLICT DO NOTHING;`
  );
}

out.push("\n-- CONTRACTS");
const contractFirstRow = new Map(); // key → first row
for (const r of rows) {
  if (!r.prog) continue;
  const key = r.email.toLowerCase() + "|" + r.prog.trim();
  if (!contractFirstRow.has(key)) contractFirstRow.set(key, r);
}
for (const [key, r] of contractFirstRow) {
  const id = contractMap.get(key);
  const clientId = clientMap.get(r.email.toLowerCase());
  const productId = productMap.get(r.prog.trim());
  if (!clientId || !productId) continue;
  const startDate = parseDate(r.data) || "2023-01-01";
  const amount = r.totale || r.amount || 0;
  const now = new Date().toISOString();
  out.push(
    `INSERT INTO "Contract" (id, "clientId", "productId", type, amount, "startDate", active, "createdAt", "updatedAt") VALUES ` +
    `(${sq(id)}, ${sq(clientId)}, ${sq(productId)}, 'ONE_SHOT', ${amount}, '${startDate}', true, '${now}', '${now}') ON CONFLICT DO NOTHING;`
  );
}

out.push("\n-- INVOICES & PAYMENTS");
const invoiceNumCount = new Map();
for (const r of rows) {
  const baseNum = r.fatNum || "MYB";
  const count = (invoiceNumCount.get(baseNum) || 0) + 1;
  invoiceNumCount.set(baseNum, count);
  const suffix = invoiceNumCount.get(baseNum) > 1 ? `-${count}` : "";
  const number = `MYB-${baseNum}${suffix}`;

  const clientId = clientMap.get(r.email.toLowerCase());
  const contractKey = r.email.toLowerCase() + "|" + (r.prog?.trim() || "");
  const contractId = contractMap.get(contractKey);
  if (!clientId) continue;

  const issueDate = parseDate(r.data) || "2023-01-01";
  const dueDate = issueDate; // same day as issue for simplicity
  const status = invoiceStatus(r.stato);
  const paidAt = parseDate(r.dataPagato);
  const amount = r.amount || 0;
  const invId = randomUUID();
  const now = new Date().toISOString();

  const lineItems = JSON.stringify([{ description: r.prog || "Servizio", qty: 1, price: amount }]).replace(/'/g, "''");

  out.push(
    `INSERT INTO "Invoice" (id, number, "clientId", "contractId", amount, status, "issueDate", "dueDate", "paidAt", "lineItems", "createdAt", "updatedAt") VALUES ` +
    `(${sq(invId)}, ${sq(number)}, ${sq(clientId)}, ${contractId ? sq(contractId) : "NULL"}, ${amount}, '${status}', '${issueDate}', '${dueDate}', ${paidAt ? sq(paidAt) : "NULL"}, '${lineItems}', '${now}', '${now}') ON CONFLICT (number) DO NOTHING;`
  );

  // Payment for paid invoices
  if (status === "PAID" && paidAt) {
    const payId = randomUUID();
    const method = paymentMethod(r.metodo);
    out.push(
      `INSERT INTO "Payment" (id, "invoiceId", amount, method, "paidAt", "createdAt") VALUES ` +
      `(${sq(payId)}, ${sq(invId)}, ${amount}, '${method}', '${paidAt}', '${now}') ON CONFLICT DO NOTHING;`
    );
  }
}

console.log(out.join("\n"));
