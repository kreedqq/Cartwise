import { UI_TYPE } from "@/lib/design/tokens";

interface ShopCatalogHeaderProps {
  eyebrow: string;
  title: string;
  productCount: number;
  description?: string;
  actions?: React.ReactNode;
}

export function ShopCatalogHeader({
  eyebrow,
  title,
  productCount,
  description,
  actions,
}: ShopCatalogHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className={UI_TYPE.eyebrow}>{eyebrow}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {productCount} {productCount === 1 ? "Produkt" : "Produkte"}
          </span>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
