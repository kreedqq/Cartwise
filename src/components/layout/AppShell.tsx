import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { SiteBackground } from "@/components/layout/SiteBackground";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { NavShellProvider } from "@/context/NavShellProvider";
import { useSiteDesign } from "@/hooks/useTrustExperience";
import { designHasVisibleBackground } from "@/lib/siteDesign";
import { cn } from "@/lib/utils";

export function AppShell() {
  const designQuery = useSiteDesign();
  const designOn = Boolean(
    designQuery.data && designHasVisibleBackground(designQuery.data.enabled, designQuery.data.config),
  );

  return (
    <NavShellProvider>
      <div className={cn("relative flex min-h-screen", designOn ? "bg-transparent" : "bg-background")}>
        <SiteBackground />
        <Sidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 pb-20 lg:pb-0">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
              <Outlet />
            </div>
          </main>
        </div>
        <MobileNav />
        <MobileNavDrawer />
      </div>
    </NavShellProvider>
  );
}
