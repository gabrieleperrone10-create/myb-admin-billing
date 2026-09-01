"use server";

import { auth } from "@clerk/nextjs/server";
import { basePrisma, companyDb } from "@/lib/db";
import { seedDefaultRoles } from "@/lib/roleSeed";
import { RESERVED_SLUGS, SLUG_PATTERN, listMyCompanies } from "@/lib/company";

/**
 * Le 7 automazioni note al gestionale (vedi (dashboard)/automations/page.tsx).
 * Vengono create disattivate: i cron chiamano `automation.update({ where:
 * { companyId_type } })`, che LANCIA se la riga manca — quindi vanno create al
 * provisioning, non lasciate comparire alla prima attivazione manuale.
 */
const AUTOMATION_TYPES = [
  "OVERDUE_REMINDER", "OVERDUE_ALERT", "RECURRING_INVOICES",
  "CONTRACT_WELCOME", "CONTRACT_EXPIRING", "MONTHLY_PL_REPORT", "CASHFLOW_FORECAST",
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // accenti
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createCompany(formData: FormData): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Non autenticato" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { ok: false, error: "Il nome è obbligatorio" };

  const slugInput = (formData.get("slug") as string)?.trim();
  const slug = slugify(slugInput || name);
  if (!slug || !SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "Slug non valido: usa solo lettere minuscole, numeri e trattini" };
  }

  const invoicePrefix = (formData.get("invoicePrefix") as string)?.trim().toUpperCase()
    || name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()
    || "INV";

  const existing = await basePrisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return { ok: false, error: `L'indirizzo "${slug}" è già in uso da un'altra azienda` };

  const isFirstCompany = (await listMyCompanies()).length === 0;

  // Non e' un'unica transazione: seedDefaultRoles/automation.createMany operano
  // su tabelle appena create (companyId nuovo), quindi l'unico fallimento
  // realistico e' un errore di connessione transitorio. Se capita dopo la
  // create della Company, la pagina ruoli la ripara da sola al primo accesso
  // (getRoles() richiama seedDefaultRoles con la stessa guardia "existing===0").
  try {
    const company = await basePrisma.company.create({
      data: {
        slug,
        name,
        email: "",
        invoicePrefix,
        creditNotePrefix: "NC",
      },
    });

    await basePrisma.companyMember.create({
      data: { companyId: company.id, clerkUserId: userId, isDefault: isFirstCompany },
    });

    const db = companyDb(company.id);
    await seedDefaultRoles(db, company.id, userId);

    await basePrisma.automation.createMany({
      data: AUTOMATION_TYPES.map(type => ({ companyId: company.id, type, active: false })),
    });

    return { ok: true, slug: company.slug };
  } catch (e) {
    console.error("createCompany error:", e);
    return { ok: false, error: "Errore durante la creazione dell'azienda. Riprova." };
  }
}
