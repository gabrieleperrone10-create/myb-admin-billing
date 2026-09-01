export const dynamic = "force-dynamic";
import Link from "next/link";
import { Check } from "lucide-react";
import { requireCompany, listMyCompanies } from "@/lib/company";
import CreateCompanyForm from "./CreateCompanyForm";

export default async function CompaniesPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const { company: current } = await requireCompany(slug);
  const companies = await listMyCompanies();

  return (
    <div className="max-w-[720px] space-y-8">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>
          Aziende
        </h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          Ogni azienda ha clienti, fatture, contratti e permessi completamente separati.
        </p>
      </div>

      <div className="space-y-2">
        {companies.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--r-lg)]"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 font-bold text-[13px]"
              style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}
            >
              {c.name[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-fg">{c.name}</p>
              <p className="text-[12px] text-fg-3">
                /{c.slug} · numerazione {c.invoicePrefix}-
              </p>
            </div>
            {c.slug === current.slug ? (
              <span className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--info)" }}>
                <Check className="w-3.5 h-3.5" /> Attiva
              </span>
            ) : (
              <Link
                href={`/${c.slug}/dashboard`}
                className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--r-md)]"
                style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}
              >
                Passa a questa
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <h2 className="text-[15px] font-semibold text-fg mt-6 mb-1">Nuova azienda</h2>
        <p className="text-[12px] text-fg-3 mb-4">
          Crea un&apos;azienda completamente isolata: clienti, fatture, ruoli e automazioni ripartono da zero.
        </p>
        <CreateCompanyForm />
      </div>
    </div>
  );
}
