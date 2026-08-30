import { describe, expect, it } from "vitest";

import {
  cartNameSchema,
  parsePasteLine,
  productCodeSchema,
  quantitySchema,
  registerSchema,
} from "@/lib/validation";

describe("productCodeSchema", () => {
  it("normalizes casing and whitespace", () => {
    expect(productCodeSchema.parse("  art-1001 ")).toBe("ART-1001");
  });

  it("rejects an empty code", () => {
    expect(productCodeSchema.safeParse("   ").success).toBe(false);
  });
});

describe("quantitySchema", () => {
  it("accepts comma-decimal string input", () => {
    expect(quantitySchema.parse("1,5")).toBe(1.5);
  });

  it("rejects zero, negative, and non-numeric input", () => {
    expect(quantitySchema.safeParse("0").success).toBe(false);
    expect(quantitySchema.safeParse("-3").success).toBe(false);
    expect(quantitySchema.safeParse("abc").success).toBe(false);
    expect(quantitySchema.safeParse("").success).toBe(false);
  });

  it("rejects quantities above the configured maximum", () => {
    expect(quantitySchema.safeParse(100001).success).toBe(false);
  });

  it("rejects more than 3 decimal places", () => {
    expect(quantitySchema.safeParse(1.2345).success).toBe(false);
  });
});

describe("cartNameSchema", () => {
  it("requires a non-empty, trimmed name", () => {
    expect(cartNameSchema.safeParse("  ").success).toBe(false);
    expect(cartNameSchema.parse(" Büro Q3 ")).toBe("Büro Q3");
  });

  it("rejects names over 120 characters", () => {
    expect(cartNameSchema.safeParse("a".repeat(121)).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    email: "test@example.com",
    password: "supersecret1",
    passwordConfirm: "supersecret1",
    displayName: "Test Nutzer",
    username: "TestNutzer",
  };

  it("accepts a valid registration payload", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...base, passwordConfirm: "different1" });
    expect(result.success).toBe(false);
  });

  it("rejects a password without a digit", () => {
    const result = registerSchema.safeParse({ ...base, password: "onlyletters", passwordConfirm: "onlyletters" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email address", () => {
    expect(registerSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });
});

describe("parsePasteLine", () => {
  it("parses tab-separated code and quantity", () => {
    const result = parsePasteLine("ART-1001\t5");
    expect(result).toEqual({ raw: "ART-1001\t5", code: "ART-1001", quantity: 5, error: null });
  });

  it("parses space-separated code and comma-decimal quantity", () => {
    const result = parsePasteLine("art-2002   2,5");
    expect(result?.code).toBe("ART-2002");
    expect(result?.quantity).toBe(2.5);
  });

  it("returns null for a blank line", () => {
    expect(parsePasteLine("   ")).toBeNull();
  });

  it("flags a missing quantity", () => {
    const result = parsePasteLine("ART-1001");
    expect(result?.error).toBe("Menge fehlt.");
  });

  it("flags a non-numeric or zero quantity", () => {
    expect(parsePasteLine("ART-1001 abc")?.error).toBe("Menge ist ungültig.");
    expect(parsePasteLine("ART-1001 0")?.error).toBe("Menge ist ungültig.");
  });
});
