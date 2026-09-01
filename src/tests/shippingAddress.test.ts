import { describe, expect, it } from "vitest";

import {
  DELIVERY_METHOD_LABELS,
  formatDeliveryMethodLabel,
  formatShippingAddressLines,
  formatShippingRecipient,
  hasShippingSnapshot,
  parseCheckoutShipping,
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

  it("formats Packstation snapshots without inventing a street address", () => {
    const snapshot = {
      shipping_delivery_method: "packstation",
      shipping_first_name: "Ada",
      shipping_last_name: "Lovelace",
      shipping_packstation_number: "139",
      shipping_post_number: "123456",
      shipping_postal_code: "10115",
      shipping_city: "Berlin",
      shipping_country: "Deutschland",
    };
    expect(formatDeliveryMethodLabel(snapshot.shipping_delivery_method)).toBe(DELIVERY_METHOD_LABELS.packstation);
    expect(formatShippingRecipient(snapshot)).toBe("Ada Lovelace");
    expect(formatShippingAddressLines(snapshot)).toEqual([
      "Packstation 139",
      "Postnummer 123456",
      "10115 Berlin",
      "Deutschland",
    ]);
    expect(hasShippingSnapshot(snapshot)).toBe(true);
  });
});

describe("checkout Lieferart validation", () => {
  const home = {
    deliveryMethod: "home" as const,
    firstName: "Ada",
    lastName: "Lovelace",
    street: "Example Street",
    houseNumber: "10",
    addressExtra: "",
    packstationNumber: "",
    postNumber: "",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
  };

  it("requires a delivery method", () => {
    const result = parseCheckoutShipping({ ...home, deliveryMethod: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.fieldErrors.deliveryMethod).toMatch(/Lieferart/);
    }
  });

  it("accepts Haustür Zustellung with the existing address fields", () => {
    const result = parseCheckoutShipping(home);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deliveryMethod).toBe("home");
    }
  });

  it("rejects Haustür Zustellung without street or house number", () => {
    expect(parseCheckoutShipping({ ...home, street: "" }).success).toBe(false);
    expect(parseCheckoutShipping({ ...home, houseNumber: "" }).success).toBe(false);
  });

  it("accepts Paketstation with packstation number and post number", () => {
    const result = parseCheckoutShipping({
      ...home,
      deliveryMethod: "packstation",
      street: "",
      houseNumber: "",
      packstationNumber: "139",
      postNumber: "123456",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.deliveryMethod === "packstation") {
      expect(result.data.packstationNumber).toBe("139");
      expect(result.data.postNumber).toBe("123456");
    }
  });

  it("rejects Paketstation without packstation number or post number", () => {
    expect(
      parseCheckoutShipping({
        ...home,
        deliveryMethod: "packstation",
        packstationNumber: "",
        postNumber: "123456",
      }).success,
    ).toBe(false);
    expect(
      parseCheckoutShipping({
        ...home,
        deliveryMethod: "packstation",
        packstationNumber: "139",
        postNumber: "",
      }).success,
    ).toBe(false);
  });
});
