import { cn } from "@/lib/utils";
import { useNavShell } from "@/context/NavShellProvider";

const LOGO_SRC = "/peptix-logo.png";

export function BrandMark({
  className,
  inverted = false,
  onClick,
}: {
  className?: string;
  inverted?: boolean;
  onClick?: () => void;
}) {
  const navShell = useNavShell();
  const handleClick = onClick ?? navShell.toggleNavigation;
  const navOpen = navShell.mobileNavOpen || !navShell.sidebarCollapsed;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center border-0 bg-transparent p-0",
        inverted ? "text-sidebar-foreground" : "text-foreground",
        className,
      )}
      aria-label={navOpen ? "Navigation schließen" : "Navigation öffnen"}
    >
      <img
        src={LOGO_SRC}
        alt="PEPTIX"
        width={2172}
        height={724}
        className="h-7 w-auto max-w-[8.5rem] object-contain object-left sm:h-8 sm:max-w-[9.5rem] lg:h-9 lg:max-w-[10.5rem]"
        draggable={false}
      />
    </button>
  );
}
