import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/constants";

export function BrandMark({
  className,
  inverted = false,
  showWordmark = true,
}: {
  className?: string;
  inverted?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-[12px] font-semibold tracking-[0.16em] text-primary-foreground"
        aria-hidden="true"
      >
        PX
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-display text-[15px] font-semibold uppercase tracking-[0.28em]",
            inverted ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          {BRAND_NAME}
        </span>
      )}
    </div>
  );
}
