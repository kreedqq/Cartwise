import * as React from "react";

interface NavShellContextValue {
  mobileNavOpen: boolean;
  sidebarCollapsed: boolean;
  toggleNavigation: () => void;
  closeMobileNav: () => void;
}

const NavShellContext = React.createContext<NavShellContextValue | null>(null);

export function NavShellProvider({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const toggleNavigation = React.useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileNavOpen((open) => !open);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  }, []);

  const closeMobileNav = React.useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({ mobileNavOpen, sidebarCollapsed, toggleNavigation, closeMobileNav }),
    [mobileNavOpen, sidebarCollapsed, toggleNavigation, closeMobileNav],
  );

  return <NavShellContext.Provider value={value}>{children}</NavShellContext.Provider>;
}

export function useNavShell(): NavShellContextValue {
  const ctx = React.useContext(NavShellContext);
  if (!ctx) {
    throw new Error("useNavShell must be used within NavShellProvider");
  }
  return ctx;
}
