/**
 * Deactivate only active 0-price SKUs that GENXELL marks OUT OF STOCK (red).
 * Never invent a unit price. Never deactivate AVAILABLE or unmatched 0-price rows.
 */
export type ExcelAvailability = "AVAILABLE" | "OUT_OF_STOCK" | "UNKNOWN";

export type ZeroPriceAction = "deactivate" | "keep-blocker" | "keep";

export function zeroPriceAction(input: {
  priceUsd: number;
  isActive: boolean;
  excelStatus: ExcelAvailability;
}): ZeroPriceAction {
  if (!input.isActive || input.priceUsd !== 0) return "keep";
  if (input.excelStatus === "OUT_OF_STOCK") return "deactivate";
  return "keep-blocker";
}
