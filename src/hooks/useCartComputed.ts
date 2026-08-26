import * as React from "react";

import { calculateCartTotals, computeLine, normalizeProductCode } from "@/lib/money";
import type { Tables } from "@/types/database";

export interface ComputedCartItem extends Tables<"cart_items"> {
  totalUsd: number | null;
  totalEur: number | null;
  eurUnavailableReason: "no-rate" | "invalid-price" | null;
  isDuplicateCode: boolean;
}

/**
 * Combines raw cart_items with the current view of quantity/price into
 * ready-to-render numbers, and flags duplicate codes within the same cart
 * (see docs/KONZEPT.md assumption A3 - duplicates are allowed but flagged,
 * never silently merged).
 */
export function useCartComputed(items: Tables<"cart_items">[] | undefined) {
  return React.useMemo(() => {
    const list = items ?? [];

    const codeCounts = new Map<string, number>();
    for (const item of list) {
      const code = item.product_code_snapshot ?? normalizeProductCode(item.product_code_input);
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }

    const computed: ComputedCartItem[] = list.map((item) => {
      const line = computeLine(item.quantity, item.unit_price_usd_snapshot, item.exchange_rate_snapshot);
      const code = item.product_code_snapshot ?? normalizeProductCode(item.product_code_input);
      return {
        ...item,
        totalUsd: line.totalUsd,
        totalEur: line.totalEur,
        eurUnavailableReason: line.eurUnavailableReason,
        isDuplicateCode: (codeCounts.get(code) ?? 0) > 1,
      };
    });

    const totals = calculateCartTotals(
      computed.map((c) => ({
        quantity: c.quantity,
        totalUsd: c.totalUsd,
        totalEur: c.totalEur,
        resolutionStatus: c.resolution_status,
      })),
    );

    const duplicateCodes = Array.from(codeCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code);

    return { items: computed, totals, duplicateCodes };
  }, [items]);
}
