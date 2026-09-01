import { NextRequest, NextResponse } from "next/server";
import { requireCompanyFromRequest } from "@/lib/company";

export interface SearchResult {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireCompanyFromRequest(req);
  if ("response" in auth) return auth.response;
  const { db } = auth.ctx;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const like = { contains: q, mode: "insensitive" as const };

  const [clients, invoices, contracts, products, expenses, sops, events, team] = await Promise.all([
    db.client.findMany({
      where: { OR: [{ name: like }, { email: like }, { company: like }] },
      select: { id: true, name: true, email: true, company: true },
      take: 5,
    }),
    db.invoice.findMany({
      where: { OR: [{ number: like }, { notes: like }, { client: { name: like } }] },
      select: { id: true, number: true, amount: true, status: true, client: { select: { name: true } } },
      take: 5,
    }),
    db.contract.findMany({
      where: { OR: [{ client: { name: like } }, { product: { name: like } }, { notes: like }] },
      select: { id: true, client: { select: { name: true } }, product: { select: { name: true } }, amount: true },
      take: 5,
    }),
    db.product.findMany({
      where: { OR: [{ name: like }, { description: like }] },
      select: { id: true, name: true, type: true, basePrice: true },
      take: 5,
    }),
    db.expense.findMany({
      where: { OR: [{ description: like }, { vendor: like }] },
      select: { id: true, description: true, vendor: true, amount: true, category: true },
      take: 5,
    }),
    db.sop.findMany({
      where: { title: like },
      select: { id: true, title: true, published: true },
      take: 5,
    }),
    db.event.findMany({
      where: { OR: [{ title: like }, { description: like }] },
      select: { id: true, title: true, type: true },
      take: 4,
    }),
    db.teamMember.findMany({
      where: { OR: [{ name: like }, { email: like }, { role: like }] },
      select: { id: true, name: true, role: true, email: true },
      take: 4,
    }),
  ]);

  const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);

  const results: SearchResult[] = [
    ...clients.map(c => ({
      id: c.id, type: "Cliente",
      label: c.name,
      sublabel: c.company ?? c.email,
      href: `/clients/${c.id}`,
    })),
    ...invoices.map(i => ({
      id: i.id, type: "Fattura",
      label: i.number,
      sublabel: `${i.client.name} · ${fmt(i.amount)} · ${i.status}`,
      href: `/invoices/${i.id}`,
    })),
    ...contracts.map(c => ({
      id: c.id, type: "Contratto",
      label: `${c.client.name} — ${c.product.name}`,
      sublabel: fmt(c.amount),
      href: `/contracts/${c.id}`,
    })),
    ...products.map(p => ({
      id: p.id, type: "Prodotto",
      label: p.name,
      sublabel: `${p.type} · ${fmt(p.basePrice)}`,
      href: `/products/${p.id}`,
    })),
    ...expenses.map(e => ({
      id: e.id, type: "Spesa",
      label: e.description,
      sublabel: `${e.vendor ?? e.category} · ${fmt(e.amount)}`,
      href: `/expenses/${e.id}`,
    })),
    ...sops.map(s => ({
      id: s.id, type: "SOP",
      label: s.title,
      sublabel: s.published ? "Pubblicato" : "Bozza",
      href: `/sop/${s.id}`,
    })),
    ...events.map(e => ({
      id: e.id, type: "Evento",
      label: e.title,
      sublabel: e.type,
      href: `/events`,
    })),
    ...team.map(m => ({
      id: m.id, type: "Team",
      label: m.name,
      sublabel: m.role ?? m.email,
      href: `/team`,
    })),
  ];

  return NextResponse.json(results);
}
