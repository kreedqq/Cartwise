/** Shared admin + storefront spacing/radius tokens (extend gradually; avoid one-off magic numbers). */

export const UI_RADIUS = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
} as const;

export const UI_SPACING = {
  page: "space-y-6",
  section: "space-y-4",
  stackSm: "gap-2",
  stackMd: "gap-3",
  stackLg: "gap-4",
} as const;

export const UI_TYPE = {
  pageTitle: "font-display text-2xl font-semibold tracking-tight sm:text-3xl",
  sectionTitle: "font-display text-xl font-semibold tracking-tight",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
  body: "text-sm leading-relaxed text-muted-foreground",
} as const;
