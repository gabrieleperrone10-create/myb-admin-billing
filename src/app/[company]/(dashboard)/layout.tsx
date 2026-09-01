import { Suspense } from "react";
import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { requireCompany, listMyCompanies, companyDisplayName } from "@/lib/company";
import { getUserPermissions, canView, ALL_SECTIONS } from "@/lib/permissions";

/**
 * requireCompany() e' memoizzata con cache(): questa chiamata e quella dentro
 * DashboardLayout condividono la stessa query, non ne raddoppiano il costo.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string }>;
}): Promise<Metadata> {
  const { company: slug } = await params;
  const ctx = await requireCompany(slug);
  return { title: `${companyDisplayName(ctx.company)} — Admin` };
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const [ctx, companies] = await Promise.all([requireCompany(slug), listMyCompanies()]);
  const perms = await getUserPermissions(ctx.db, ctx.companyId, ctx.userId);
  const allowedSections = ALL_SECTIONS.filter(s => canView(perms, s));
  const companyOptions = companies.map(c => ({ slug: c.slug, name: companyDisplayName(c), logoUrl: c.logoUrl }));

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar
          allowedSections={allowedSections}
          companyName={companyDisplayName(ctx.company)}
          companyLogoUrl={ctx.company.logoUrl}
          companies={companyOptions}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={null}>
            <Topbar
              companies={companyOptions}
              currentCompanyName={companyDisplayName(ctx.company)}
              currentCompanyLogoUrl={ctx.company.logoUrl}
            />
          </Suspense>

          <main className="flex-1 overflow-y-auto">
            <div
              className="px-4 py-5 md:p-7"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
            >
              {children}
            </div>
          </main>
        </div>

        <Suspense fallback={null}>
          <BottomNav allowedSections={allowedSections} />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
