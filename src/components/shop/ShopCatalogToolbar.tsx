import { Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOP_CATALOG_SORT_OPTIONS, type ShopCatalogSort } from "@/lib/shop/catalogSort";
import { cn } from "@/lib/utils";

interface ShopCatalogToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onOpenFilters?: () => void;
  filterActive?: boolean;
  categoryPills?: React.ReactNode;
  sortValue?: ShopCatalogSort;
  onSortChange?: (sort: ShopCatalogSort) => void;
  className?: string;
}

export function ShopCatalogToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Produkte suchen …",
  onOpenFilters,
  filterActive = false,
  categoryPills,
  sortValue = "recommended",
  onSortChange,
  className,
}: ShopCatalogToolbarProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {categoryPills ? <div className="flex flex-wrap gap-1.5">{categoryPills}</div> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8 text-sm"
            aria-label="Produkte suchen"
          />
        </div>
        {onSortChange ? (
          <Select value={sortValue} onValueChange={(v) => onSortChange(v as ShopCatalogSort)}>
            <SelectTrigger className="h-9 w-full shrink-0 sm:w-[10.5rem]" aria-label="Sortieren">
              <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
              {SHOP_CATALOG_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {onOpenFilters ? (
          <Button
            type="button"
            variant={filterActive ? "secondary" : "outline"}
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={onOpenFilters}
          >
            <Filter className="h-4 w-4" aria-hidden />
            Filter
          </Button>
        ) : null}
      </div>
    </div>
  );
}
