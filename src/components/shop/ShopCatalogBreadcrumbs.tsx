import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export function ShopCatalogBreadcrumbs({
  items,
  className,
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Brotkrumen" className={cn("text-[11px] text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden className="opacity-40">/</span> : null}
            {item.href ? (
              <Link to={item.href} className="hover:text-foreground/90">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground/80">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
