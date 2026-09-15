import { describe, expect, it } from "vitest";

import {
  formatHistoricalOrderItemQuantity,
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
  | "dosage_vial_snapshot"
> {
  return {
    kit_share_id_snapshot: null,
    kit_size_vials_snapshot: null,
    kit_participant_quantity_snapshot: null,
    quantity: 4,
    product_name_snapshot: "Selank",
    product_code_snapshot: "SK10",
    dosage_vial_snapshot: null,
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
    ).toBe("4/10 Kit");
    expect(
      formatKitShareLabelForOrderItem(
        item({
          kit_share_id_snapshot: "kit-1",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 2,
          quantity: 4,
        }),
      ),
    ).toBe("2/10 Kit");
    expect(
      formatKitShareLabelForOrderItem(
        item({
          kit_share_id_snapshot: "kit-1",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 10,
        }),
      ),
    ).toBe("1 Kit");
    expect(
      formatKitShareLabelForOrderItem(
        item({
          kit_share_id_snapshot: "kit-1",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 5,
        }),
      ),
    ).toBe("5/10 Kit");
  });
});

describe("formatHistoricalOrderItemQuantity", () => {
  it("shows vial counts for group-buy catalog lines without kit snapshot", () => {
    expect(formatHistoricalOrderItemQuantity(item({ quantity: 1, product_code_snapshot: "AD10", product_name_snapshot: "Adamax" }))).toBe(
      "1 Vial",
    );
    expect(formatHistoricalOrderItemQuantity(item({ quantity: 4, product_code_snapshot: "KP10", product_name_snapshot: "KPV" }))).toBe(
      "4 Vials",
    );
    expect(formatHistoricalOrderItemQuantity(item({ quantity: 7, product_code_snapshot: "SM10", product_name_snapshot: "Semax" }))).toBe(
      "7 Vials",
    );
  });

  it("does not infer kit from quantity when kit_share_id_snapshot is missing", () => {
    expect(
      formatHistoricalOrderItemQuantity(
        item({
          quantity: 4,
          kit_size_vials_snapshot: 10,
          product_code_snapshot: "KP10",
          product_name_snapshot: "KPV",
        }),
      ),
    ).toBe("4 Vials");
    expect(
      formatHistoricalOrderItemQuantity(
        item({
          quantity: 1,
          kit_size_vials_snapshot: 10,
          product_code_snapshot: "AD10",
          product_name_snapshot: "Adamax",
        }),
      ),
    ).toBe("1 Vial");
  });

  it("shows kit fraction only with kit_share_id_snapshot", () => {
    expect(
      formatHistoricalOrderItemQuantity(
        item({
          kit_share_id_snapshot: "kit-selank",
          kit_size_vials_snapshot: 10,
          kit_participant_quantity_snapshot: 4,
          quantity: 4,
          product_name_snapshot: "Selank",
          product_code_snapshot: "SK10",
        }),
      ),
    ).toBe("4/10 Kit");
  });
});
