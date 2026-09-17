import * as React from "react";
import { Filter, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KitRequestSort } from "@/lib/kitRequests";
import { formatProductVariant } from "@/lib/shop/variantCoverage";
import type { ShopProductGroup } from "@/lib/shop/display";
import { cn } from "@/lib/utils";

interface CategoryOption {
  category_key: string;
  label: string;
}

interface KitRequestFilterBarProps {
  searchId: string;
  search: string;
  onSearch: (value: string) => void;
  category: string | null;
  onCategory: (value: string | null) => void;
  categories: CategoryOption[];
  productName: string | null;
  onProductName: (value: string | null) => void;
  groups: ShopProductGroup[];
  variant: string | null;
  onVariant: (value: string | null, productId: string | null) => void;
  variantOptions: ShopProductGroup["variants"];
  minRemaining: number | null;
  onMinRemaining: (value: number | null) => void;
  sort: KitRequestSort;
  onSort: (value: KitRequestSort) => void;
}

export function KitRequestFilterBar(props: KitRequestFilterBarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const activeFilterCount = [
    props.category != null,
    props.productName != null,
    props.variant != null,
    props.minRemaining != null,
    props.sort !== "newest",
  ].filter(Boolean).length;

  return (
    <>
      {/* ── Search (always visible) ──────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={props.searchId}
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Produkt suchen …"
            className="min-h-11 pl-10"
            aria-label="Produkt suchen"
          />
        </div>

        {/* ── Mobile filter trigger ─────────────────────────────────────── */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative h-11 shrink-0 gap-1.5 sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Filter öffnen"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filter
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* ── Desktop filter grid (hidden on mobile) ───────────────────────── */}
      <div className="hidden sm:block">
        <FilterGrid {...props} />
      </div>

      {/* ── Mobile bottom-sheet ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Filter">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Filter schließen"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-background pb-6 shadow-elevated">
            {/* Handle + header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <h2 className="text-base font-semibold">Filter</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Filter schließen">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Filter controls */}
            <div className="overflow-y-auto px-4 pb-6">
              <FilterGrid {...props} />
            </div>

            {/* Apply button */}
            <div className="border-t border-border px-4 py-3">
              <Button className="w-full" size="lg" onClick={() => setMobileOpen(false)}>
                Filter anwenden
                {activeFilterCount > 0 && ` (${activeFilterCount} aktiv)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The actual filter controls — rendered inline on desktop,
 * rendered inside the bottom-sheet on mobile.
 */
function FilterGrid({
  category,
  onCategory,
  categories,
  productName,
  onProductName,
  groups,
  variant,
  onVariant,
  variantOptions,
  minRemaining,
  onMinRemaining,
  sort,
  onSort,
}: Omit<KitRequestFilterBarProps, "searchId" | "search" | "onSearch">) {
  return (
    <div className="space-y-3">
      <div className={cn("grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4")}>
        <FilterSelect
          label="Kategorie"
          value={category ?? "all"}
          onValueChange={(value) => onCategory(value === "all" ? null : value)}
          items={[{ value: "all", label: "Alle" }, ...categories.map((cat) => ({ value: cat.category_key, label: cat.label }))]}
        />
        <FilterSelect
          label="Produkt"
          value={productName ?? "all"}
          onValueChange={(value) => onProductName(value === "all" ? null : value)}
          items={[
            { value: "all", label: "Alle" },
            ...groups.map((group) => ({
              value: group.variants[0]?.name ?? group.displayName,
              label: group.displayName,
            })),
          ]}
        />
        <FilterSelect
          label="Variante"
          value={variant ?? "all"}
          disabled={!productName}
          onValueChange={(value) => {
            if (value === "all") {
              onVariant(null, null);
              return;
            }
            const match = variantOptions.find((item) => (item.dosage_vial || item.code) === value);
            onVariant(value, match?.id ?? null);
          }}
          items={[
            { value: "all", label: "Alle" },
            ...variantOptions.map((item) => ({
              value: item.dosage_vial || item.code,
              label: formatProductVariant(item),
            })),
          ]}
        />
        <FilterSelect
          label="Verfügbarkeit"
          value={minRemaining == null ? "all" : String(minRemaining)}
          onValueChange={(value) => onMinRemaining(value === "all" ? null : Number(value))}
          items={[
            { value: "all", label: "Beliebig" },
            { value: "1", label: "Mind. 1" },
            { value: "2", label: "Mind. 2" },
            { value: "4", label: "Mind. 4" },
            { value: "6", label: "Mind. 6" },
          ]}
        />
      </div>
      <div className="max-w-xs">
        <FilterSelect
          label="Sortierung"
          value={sort}
          onValueChange={(value) => onSort(value as KitRequestSort)}
          items={[
            { value: "newest", label: "Neueste" },
            { value: "fewest_remaining", label: "Am vollsten" },
            { value: "most_remaining", label: "Meiste frei" },
          ]}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  items,
  onValueChange,
  disabled,
}: {
  label: string;
  value: string;
  items: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="min-h-11 w-full" aria-label={`${label} filtern`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
