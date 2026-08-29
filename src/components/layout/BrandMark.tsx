import { cn } from "@/lib/utils";
import { useNavShell } from "@/context/NavShellProvider";

const LOGO_SRC = "/peptix-logo.svg";

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

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex max-w-full items-center border-0 bg-transparent p-0",
        inverted ? "text-sidebar-foreground" : "text-foreground",
        className,
      )}
      aria-label="Navigation öffnen"
    >
      <img
        src={LOGO_SRC}
        alt="PEPTIX"
        className="h-8 w-auto max-w-[9.5rem] object-contain object-left sm:h-9 sm:max-w-[10.5rem]"
        draggable={false}
      />
    </button>
  );
}
