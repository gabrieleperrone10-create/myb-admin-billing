import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
  ].join("\n");
}

function dateRange(sp: URLSearchParams) {
  const period = sp.get("period") ?? "all";
  const now    = new Date();
  switch (period) {
    case "day":   { const s = new Date(now); s.setHours(0,0,0,0); return { gte: s, lte: now }; }
    case "week":  { const s = new Date(now); s.setDate(s.getDate()-(s.getDay()===0?6:s.getDay()-1)); s.setHours(0,0,0,0); return { gte: s, lte: now }; }
    case "month": return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: now };
    case "year":  return { gte: new Date(now.getFullYear(), 0, 1), lte: now };
    case "custom": return {
      gte: sp.get("from") ? new Date(sp.get("from")!) : new Date("2018-01-01"),
      lte: sp.get("to")   ? new Date(sp.get("to")! + "T23:59:59") : now,
    };
    default: return undefined;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  const sp         = req.nextUrl.searchParams;
  const q          = sp.get("q") ?? "";
  const range      = dateRange(sp);

  let csv = "";
  let filename = entity;

  try {
    switch (entity) {
      case "clients": {
        const rows = await prisma.client.findMany({
          where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }] } : undefined,
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, nome: r.name, email: r.email, azienda: r.company ?? "", telefono: r.phone ?? "", citta: r.city ?? "", paese: r.country ?? "", creato: r.createdAt })));
        break;
      }
      case "invoices": {
        const status = sp.get("status");
        const rows = await prisma.invoice.findMany({
          where: {
            ...(status ? { status: status as never } : {}),
            ...(range ? { issueDate: range } : {}),
            ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] } : {}),
          },
          include: { client: true },
          orderBy: { issueDate: "desc" },
        });
        csv = toCSV(rows.map(r => ({ numero: r.number, cliente: r.client.name, importo: r.amount, valuta: r.currency, stato: r.status, emissione: r.issueDate, scadenza: r.dueDate, pagato_il: r.paidAt ?? "" })));
        break;
      }
      case "payments": {
        const rows = await prisma.payment.findMany({
          where: { ...(range ? { paidAt: range } : {}), ...(q ? { OR: [{ reference: { contains: q, mode: "insensitive" } }] } : {}) },
          include: { invoice: { include: { client: true } } },
          orderBy: { paidAt: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, cliente: r.invoice?.client.name ?? "", fattura: r.invoice?.number ?? "", importo: r.amount, metodo: r.method, data: r.paidAt, riferimento: r.reference ?? "" })));
        break;
      }
      case "expenses": {
        const category = sp.get("category");
        const rows = await prisma.expense.findMany({
          where: {
            ...(category ? { category: category as never } : {}),
            ...(range ? { date: range } : {}),
            ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { vendor: { contains: q, mode: "insensitive" } }] } : {}),
          },
          orderBy: { date: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, data: r.date, categoria: r.category, descrizione: r.description, fornitore: r.vendor ?? "", importo: r.amount, valuta: r.currency })));
        break;
      }
      case "products": {
        const rows = await prisma.product.findMany({
          where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : undefined,
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, nome: r.name, tipo: r.type, prezzo: r.basePrice, valuta: r.currency, attivo: r.active })));
        break;
      }
      case "contracts": {
        const rows = await prisma.contract.findMany({
          where: q ? { OR: [{ client: { name: { contains: q, mode: "insensitive" } } }, { product: { name: { contains: q, mode: "insensitive" } } }] } : undefined,
          include: { client: true, product: true },
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, cliente: r.client.name, prodotto: r.product.name, tipo: r.type, importo: r.amount, inizio: r.startDate, fine: r.endDate ?? "", attivo: r.active })));
        break;
      }
      case "deposits": {
        const rows = await prisma.deposit.findMany({
          where: range ? { paidAt: range } : undefined,
          include: { contract: { include: { client: true } } },
          orderBy: { createdAt: "desc" },
        });
        csv = toCSV(rows.map(r => ({ id: r.id, cliente: r.contract.client.name, importo: r.amount, stato: r.status, pagato_il: r.paidAt ?? "" })));
        break;
      }
      default:
        return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
