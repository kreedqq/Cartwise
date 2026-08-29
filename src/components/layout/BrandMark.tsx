import { cn } from "@/lib/utils";
import { useNavShell } from "@/context/NavShellProvider";

/** Original PEPTIX wordmark asset (2200×715 RGBA, 3:1). */
const LOGO_SRC = "/peptix-logo.png";
const LOGO_ASPECT = 2200 / 715;

export function BrandMark({
  className,
  inverted = false,
  onClick,
  variant = "header",
}: {
  className?: string;
  inverted?: boolean;
  onClick?: () => void;
  /** Sidebar uses the same asset but may sit in a narrower column. */
  variant?: "header" | "sidebar";
}) {
  const navShell = useNavShell();
  const handleClick = onClick ?? navShell.toggleNavigation;
  const navOpen = navShell.mobileNavOpen || !navShell.sidebarCollapsed;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center justify-start border-0 bg-transparent p-0",
        inverted ? "text-sidebar-foreground" : "text-foreground",
        className,
      )}
      aria-label={navOpen ? "Navigation schließen" : "Navigation öffnen"}
    >
      <img
        src={LOGO_SRC}
        alt="PEPTIX"
        width={2200}
        height={715}
        className={cn(
          "w-auto object-contain object-left",
          variant === "sidebar"
            ? "h-14 max-w-full sm:h-16"
            : "h-14 max-w-[calc(100vw-9rem)] sm:h-16 sm:max-w-[calc(100vw-10rem)] lg:h-20 lg:max-w-[15.5rem]",
        )}
        style={{ aspectRatio: LOGO_ASPECT }}
        draggable={false}
      />
    </button>
  );
}
