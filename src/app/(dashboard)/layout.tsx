import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Suspense fallback={null}>
          <Topbar />
        </Suspense>
        <main className="flex-1 overflow-y-auto">
          <div className="p-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
