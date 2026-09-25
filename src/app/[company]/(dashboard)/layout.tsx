import { Suspense } from "react";
import type { Metadata } from "next";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { requireCompany, listMyCompanies, companyDisplayName } from "@/lib/company";
import { getUserAccess, canView, ALL_SECTIONS } from "@/lib/permissions";
import { countMyDueTasks } from "@/lib/crm/tasks";
import { after } from "next/server";
import { autoCheckDue, runDomainAutoCheck } from "@/lib/email/domains";

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
  // Stessa regola del controllo di sezione (template.tsx): senza ruoli accesso pieno.
  const { perms } = await getUserAccess(ctx.db, ctx.companyId, ctx.userId);
  const allowedSections = ALL_SECTIONS.filter(s => canView(perms, s));
  const companyOptions = companies.map(c => ({ slug: c.slug, name: companyDisplayName(c), logoUrl: c.logoUrl }));

  // Contatori del menu Vendite. Un errore qui non deve impedire di caricare l'app.
  const [dueTasks, unread] = await Promise.all([
    countMyDueTasks(ctx.db, ctx.userId, ctx.company.timezone).catch(() => 0),
    ctx.db.contact.aggregate({ _sum: { unreadCount: true } }).then(r => r._sum.unreadCount ?? 0).catch(() => 0),
  ]);
  const badges = { "/tasks": dueTasks, "/conversations": unread };

  // Controllo automatico del dominio email (+5 min, +3 h, +24 h dal
  // collegamento): i cron su Hobby girano una volta al giorno, quindi lo si
  // esegue anche qui, in background dopo la risposta, quando e' scaduto.
  if (autoCheckDue(ctx.company)) {
    after(() => runDomainAutoCheck(ctx.companyId).catch(e => console.error("[email-domain] auto-check:", e)));
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar
          allowedSections={allowedSections}
          companyName={companyDisplayName(ctx.company)}
          companyLogoUrl={ctx.company.logoUrl}
          companies={companyOptions}
          badges={badges}
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
