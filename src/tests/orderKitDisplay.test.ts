import { describe, expect, it } from "vitest";

import {
  formatKitShareLabelForOrderItem,
  isKitOrderLine,
  kitSizeFromOrderItem,
} from "@/lib/orderKitDisplay";
import type { Tables } from "@/types/database";

function item(
  overrides: Partial<Tables<"order_items">> = {},
): Pick<
  Tables<"order_items">,
  | "kit_share_id_snapshot"
  | "kit_size_vials_snapshot"
  | "kit_participant_quantity_snapshot"
  | "quantity"
  | "product_name_snapshot"
  | "product_code_snapshot"
> {
  return {
    kit_share_id_snapshot: null,
    kit_size_vials_snapshot: null,
    kit_participant_quantity_snapshot: null,
    quantity: 4,
    product_name_snapshot: "Selank",
    product_code_snapshot: "SK10",
    ...overrides,
  };
}

describe("orderKitDisplay snapshots", () => {
  it("prefers kit_size_vials_snapshot over live kit size", () => {
    expect(kitSizeFromOrderItem(item({ kit_size_vials_snapshot: 10 }), 5)).toBe(10);
  });

  it("formats kit share from frozen participant qty", () => {
    expect(
      isKitOrderLine(item({ kit_share_id_snapshot: "kit-1", kit_size_vials_snapshot: 10 })),
    ).toBe(true);
    expect(
      formatKitShareLabelForOrderItem(
        item({
          kit_share_id_snapshot: "kit-1",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 4,
        }),
      ),
    ).toMatch(/4/);
    expect(
      formatKitShareLabelForOrderItem(
        item({
          kit_share_id_snapshot: "kit-1",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 2,
          quantity: 4,
        }),
      ),
    ).toMatch(/2/);
  });
});
