import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { getUserPermissions, canView, ALL_SECTIONS } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const perms = await getUserPermissions();
  const allowedSections = ALL_SECTIONS.filter(s => canView(perms, s));

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar allowedSections={allowedSections} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={null}>
            <Topbar />
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
