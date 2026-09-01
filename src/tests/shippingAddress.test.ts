import { describe, expect, it } from "vitest";

import {
  formatShippingAddressLines,
  formatShippingRecipient,
  hasShippingSnapshot,
  shippingAddressSchema,
} from "@/lib/shippingAddress";

describe("shippingAddressSchema", () => {
  const valid = {
    firstName: "Ada",
    lastName: "Lovelace",
    street: "Example Street",
    houseNumber: "10",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
  };

  it("accepts a complete address", () => {
    const parsed = shippingAddressSchema.parse(valid);
    expect(parsed.firstName).toBe("Ada");
    expect(parsed.lastName).toBe("Lovelace");
    expect(parsed.street).toBe("Example Street");
    expect(parsed.houseNumber).toBe("10");
    expect(parsed.city).toBe("Berlin");
  });

  it("rejects empty required fields", () => {
    expect(shippingAddressSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    expect(shippingAddressSchema.safeParse({ ...valid, street: "" }).success).toBe(false);
    expect(shippingAddressSchema.safeParse({ ...valid, houseNumber: "" }).success).toBe(false);
    expect(shippingAddressSchema.safeParse({ ...valid, postalCode: "" }).success).toBe(false);
    expect(shippingAddressSchema.safeParse({ ...valid, city: "" }).success).toBe(false);
    expect(shippingAddressSchema.safeParse({ ...valid, country: "" }).success).toBe(false);
  });

  it("allows an optional extra line and treats blank extra as absent", () => {
    expect(shippingAddressSchema.parse({ ...valid, addressExtra: "c/o Lab" }).addressExtra).toBe("c/o Lab");
    expect(shippingAddressSchema.parse({ ...valid, addressExtra: "  " }).addressExtra).toBeUndefined();
  });
});

describe("shipping snapshot formatting", () => {
  it("formats recipient and address lines from an order snapshot", () => {
    const snapshot = {
      shipping_first_name: "Ada",
      shipping_last_name: "Lovelace",
      shipping_street: "Example Street",
      shipping_house_number: "10",
      shipping_address_extra: "c/o Lab",
      shipping_postal_code: "10115",
      shipping_city: "Berlin",
      shipping_country: "Deutschland",
    };
    expect(formatShippingRecipient(snapshot)).toBe("Ada Lovelace");
    expect(formatShippingAddressLines(snapshot)).toEqual([
      "Example Street 10",
      "c/o Lab",
      "10115 Berlin",
      "Deutschland",
    ]);
    expect(hasShippingSnapshot(snapshot)).toBe(true);
  });

  it("does not treat a later profile change as part of the snapshot", () => {
    const snapshot = {
      telegram_username_snapshot: "oldhandle",
      shipping_city: "Berlin",
    };
    expect(snapshot.telegram_username_snapshot).toBe("oldhandle");
    expect(hasShippingSnapshot(snapshot)).toBe(false);
  });
});
