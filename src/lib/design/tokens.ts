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
  /** Shop catalog product name (primary scan line). */
  shopProduct: "text-[15px] font-semibold leading-snug text-foreground sm:text-base",
  shopCategory: "text-[11px] font-medium text-muted-foreground sm:text-xs",
  shopVariant: "text-xs text-foreground/90",
} as const;

/** Legacy compact list tokens (retained for reference components). */
export const SHOP_CATALOG = {
  list: "divide-y divide-border/60",
  row:
    "grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-rows-[auto_auto] max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:py-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-x-4 sm:py-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.9fr)_minmax(5.5rem,auto)_minmax(7rem,auto)_auto] lg:gap-x-5",
  rowHeader:
    "hidden lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.9fr)_minmax(5.5rem,auto)_minmax(7rem,auto)_auto] lg:gap-x-5 lg:border-b lg:border-border/50 lg:pb-2 lg:text-[11px] lg:font-semibold lg:uppercase lg:tracking-[0.14em] lg:text-muted-foreground",
  qtyStepper: "inline-flex h-9 items-center rounded-md border border-border/80 bg-background/80",
  addBtn: "min-h-11 h-11 shrink-0 gap-1.5 px-3 text-xs font-semibold sm:text-sm",
} as const;

/** Premium product grid — visual commerce catalog. */
export const SHOP_GRID = {
  layout:
    "grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4",
  card:
    "group/card relative flex h-full flex-col overflow-hidden rounded-xl bg-gradient-to-b from-card/40 to-background/20 shadow-[0_10px_32px_-22px_rgba(0,0,0,0.85)] transition-[transform,box-shadow] duration-150 motion-reduce:transition-none hover:shadow-[0_16px_40px_-18px_rgba(0,0,0,0.9)] hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
  /** Fixed hero height — stronger density at 1280 without shrinking type. */
  imageWrap: "relative h-[8.75rem] w-full overflow-hidden sm:h-[10.25rem] xl:h-[9.75rem]",
  imageInner: "absolute inset-0 flex items-center justify-center p-1 sm:p-2",
  body: "flex flex-1 flex-col gap-1.5 p-2.5 pb-2.5 sm:gap-2 sm:p-3 sm:pb-3",
  qtyStepper:
    "inline-flex h-8 w-full max-w-none items-center justify-between rounded-md border border-border/40 bg-background/50 sm:max-w-[8.75rem]",
  addBtn:
    "min-h-11 h-11 w-full gap-1.5 text-sm font-semibold shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.25)] transition-transform duration-150 motion-reduce:transition-none active:scale-[0.98]",
  badge:
    "rounded-md bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground backdrop-blur-md",
} as const;

/** Full-bleed breakout matching AppShell main padding. */
export const PAGE_BLEED =
  "-mx-4 sm:-mx-6 lg:-mx-12";

export const PAGE_BLEED_TOP = `${PAGE_BLEED} -mt-8 lg:-mt-10`;

export const PAGE_BLEED_PAD = "px-4 sm:px-6 lg:px-12";
