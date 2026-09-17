import { convertUsdToEur, formatEur, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

type DualCurrencySize = "catalog" | "compact" | "summary" | "hero";

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
  hero: {
    eur: "font-display text-4xl font-semibold tabular-nums tracking-tight leading-none text-primary sm:text-5xl [color:var(--area-price,inherit)]",
    usd: "mt-2 text-sm tabular-nums leading-tight text-muted-foreground",
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
  rateLoading = false,
  unit,
  size = "catalog",
  align = "left",
  className,
}: {
  usd: number | null | undefined;
  eur?: number | null;
  rate?: number | null;
  /** True while the central exchange-rate query is still loading (no invented FX). */
  rateLoading?: boolean;
  unit?: string | null;
  size?: DualCurrencySize;
  align?: "left" | "right";
  className?: string;
}) {
  const eurAmount =
    eur !== undefined ? eur : typeof usd === "number" ? convertUsdToEur(usd, rate) : null;
  const eurLine =
    rateLoading && typeof usd === "number"
      ? "…"
      : formatEur(eurAmount);
  const classes = SIZE_CLASSES[size];
  const unitSuffix = unit?.trim() ? ` / ${unit.trim()}` : "";

  return (
    <div
      className={cn("min-w-0", align === "right" ? "text-right" : "text-left", className)}
      data-testid="dual-currency-price"
    >
      <p
        className={classes.eur}
        data-currency="eur"
        aria-busy={rateLoading || undefined}
        aria-label={rateLoading ? "EUR-Preis wird geladen" : undefined}
      >
        {eurLine}
        {unitSuffix}
      </p>
      <p className={classes.usd} data-currency="usd">
        {formatUsd(usd)}
      </p>
    </div>
  );
}
