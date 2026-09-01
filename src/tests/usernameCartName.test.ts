import { describe, expect, it } from "vitest";

import { cartTitleFromOrdinal, defaultCartName } from "@/lib/cart/defaultCartName";
import { accountInitials, publicUsername, visibleAccountLabel } from "@/lib/username";

describe("publicUsername", () => {
  it("returns the canonical profiles.username", () => {
    expect(publicUsername({ username: "testuser" })).toBe("testuser");
  });

  it("never falls back to an email prefix", () => {
    expect(publicUsername({ username: null })).toBeNull();
    expect(publicUsername(null)).toBeNull();
  });
});

describe("visibleAccountLabel", () => {
  it("uses username, not display_name or email", () => {
    expect(visibleAccountLabel({ username: "testuser" })).toBe("testuser");
    expect(visibleAccountLabel({ username: null }, "dort")).toBe("dort");
  });

  it("builds initials from username only", () => {
    expect(accountInitials("testuser")).toBe("TE");
    expect(accountInitials(null)).toBe("");
  });
});

describe("defaultCartName", () => {
  it("uses the username as the first cart name", () => {
    expect(defaultCartName("testuser", [])).toBe("testuser");
  });

  it("numbers a second cart instead of storing Warenkorb", () => {
    expect(defaultCartName("testuser", ["testuser"])).toBe("testuser – Warenkorb 2");
    expect(defaultCartName("testuser", ["testuser", "testuser – Warenkorb 2"])).toBe("testuser – Warenkorb 3");
  });

  it("does not invent a name from an email address", () => {
    expect(defaultCartName(null, [])).toBe("Warenkorb");
    expect(defaultCartName("  ", [])).toBe("Warenkorb");
  });
});

describe("cartTitleFromOrdinal", () => {
  it("keeps ordinal 1 as the bare Telegram handle", () => {
    expect(cartTitleFromOrdinal("testuser", 1)).toBe("testuser");
    expect(cartTitleFromOrdinal("testuser", 2)).toBe("testuser – Warenkorb 2");
    expect(cartTitleFromOrdinal("testuser", 3)).toBe("testuser – Warenkorb 3");
  });

  it("does not change ordinals when the handle changes", () => {
    expect(cartTitleFromOrdinal("newhandle", 1)).toBe("newhandle");
    expect(cartTitleFromOrdinal("newhandle", 3)).toBe("newhandle – Warenkorb 3");
  });
});
