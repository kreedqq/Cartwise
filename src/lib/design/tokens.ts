/** PEPTIX visual language — composition tokens, not one-off magic numbers. */

export const UI_RADIUS = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
} as const;

export const UI_SPACING = {
  page: "space-y-12 lg:space-y-16",
  section: "space-y-6",
  stackSm: "gap-2",
  stackMd: "gap-3",
  stackLg: "gap-4",
} as const;

export const UI_TYPE = {
  display: "font-display text-[clamp(2rem,4.2vw,3.35rem)] font-semibold leading-[0.95] tracking-tight",
  pageTitle: "font-display text-2xl font-semibold tracking-tight sm:text-3xl",
  sectionTitle: "font-display text-xl font-semibold tracking-tight",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80",
  meta: "text-xs leading-relaxed text-muted-foreground",
  body: "text-sm leading-relaxed text-muted-foreground",
  price: "font-display text-2xl font-semibold tabular-nums tracking-tight text-primary sm:text-3xl",
  status: "text-xs font-semibold uppercase tracking-[0.16em]",
} as const;

/** Full-bleed breakout matching AppShell main padding. */
export const PAGE_BLEED =
  "-mx-4 sm:-mx-6 lg:-mx-12";

export const PAGE_BLEED_TOP = `${PAGE_BLEED} -mt-8 lg:-mt-10`;

export const PAGE_BLEED_PAD = "px-4 sm:px-6 lg:px-12";
