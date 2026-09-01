/**
 * Deactivate only the explicitly approved 0-price SKUs, or Excel OUT OF STOCK.
 * Never invent a unit price. Never deactivate unmatched 0-price rows.
 */
export type ExcelAvailability = "AVAILABLE" | "OUT_OF_STOCK" | "UNKNOWN";

export type ZeroPriceAction = "deactivate" | "keep-blocker" | "keep";

/** Operator-approved catalog codes. Do not expand without a new explicit request. */
export const APPROVED_ZERO_PRICE_DEACTIVATE_SKUS = ["B1201", "B1210", "GGH", "HHB", "SHB"] as const;

export function isApprovedZeroPriceDeactivation(code: string): boolean {
  return (APPROVED_ZERO_PRICE_DEACTIVATE_SKUS as readonly string[]).includes(code);
}

export function zeroPriceAction(input: {
  priceUsd: number;
  isActive: boolean;
  excelStatus: ExcelAvailability;
  code?: string;
}): ZeroPriceAction {
  if (!input.isActive || input.priceUsd !== 0) return "keep";
  if (input.code && isApprovedZeroPriceDeactivation(input.code)) return "deactivate";
  if (input.excelStatus === "OUT_OF_STOCK") return "deactivate";
  return "keep-blocker";
}
