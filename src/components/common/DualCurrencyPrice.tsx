import { convertUsdToEur, formatEur, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

type DualCurrencySize = "catalog" | "compact" | "summary";

const SIZE_CLASSES: Record<DualCurrencySize, { eur: string; usd: string }> = {
  catalog: {
    eur: "text-base font-semibold tabular-nums tracking-tight leading-tight [color:var(--area-price,inherit)]",
    usd: "text-xs tabular-nums leading-tight text-muted-foreground",
  },
  compact: {
    eur: "text-sm font-semibold tabular-nums tracking-tight leading-tight [color:var(--area-price,inherit)]",
    usd: "text-[11px] tabular-nums leading-tight text-muted-foreground",
  },
  summary: {
    eur: "text-3xl font-semibold tabular-nums tracking-tight leading-tight text-primary [color:var(--area-price,inherit)]",
    usd: "mt-1 text-sm tabular-nums leading-tight text-muted-foreground",
  },
};

/**
 * Customer-facing dual price: EUR is the primary line, USD the comparison line.
 * Values still come from formatEur / formatUsd / convertUsdToEur — no new math.
 */
export function DualCurrencyPrice({
  usd,
  eur,
  rate,
  size = "catalog",
  align = "left",
  className,
}: {
  usd: number | null | undefined;
  eur?: number | null;
  rate?: number | null;
  size?: DualCurrencySize;
  align?: "left" | "right";
  className?: string;
}) {
  const eurAmount =
    eur !== undefined ? eur : typeof usd === "number" ? convertUsdToEur(usd, rate) : null;
  const classes = SIZE_CLASSES[size];

  return (
    <div
      className={cn("min-w-0", align === "right" ? "text-right" : "text-left", className)}
      data-testid="dual-currency-price"
    >
      <p className={classes.eur} data-currency="eur">
        {formatEur(eurAmount)}
      </p>
      <p className={classes.usd} data-currency="usd">
        {formatUsd(usd)}
      </p>
    </div>
  );
}
