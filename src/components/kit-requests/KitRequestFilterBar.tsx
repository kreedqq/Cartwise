import { Search } from "lucide-react";

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

export function KitRequestFilterBar({
  searchId,
  search,
  onSearch,
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
}: KitRequestFilterBarProps) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Produkt suchen …"
          className="min-h-11 pl-10"
          aria-label="Produkt suchen"
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
