import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { RequireUsernameDialog } from "@/components/auth/RequireUsernameDialog";
import { NavShellProvider } from "@/context/NavShellProvider";

export function AppShell() {
  return (
    <NavShellProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
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
      <RequireUsernameDialog />
    </NavShellProvider>
  );
}
