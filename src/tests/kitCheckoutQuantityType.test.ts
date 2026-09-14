import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/**
 * Regression: 0088 calls cart_kit_share_is_checkout_ready(..., ci.quantity).
 * cart_items.quantity is numeric(12,3). Integer-only helper → SQLSTATE 42883 at checkout.
 */
describe("kit checkout quantity type (0088 + 0091)", () => {
  const migration0088 = read("supabase/migrations/0088_checkout_skip_incomplete_kit_lines.sql");
  const migration0091 = read("supabase/migrations/0091_cart_kit_share_checkout_ready_numeric.sql");
  const cartItems = read("supabase/migrations/0004_carts_and_items.sql");

  it("documents cart_items.quantity as numeric in schema", () => {
    expect(cartItems).toMatch(/quantity numeric\(12,\s*3\)/);
  });

  it("0088 passes cart line quantity (numeric column) into checkout-ready helper", () => {
    expect(migration0088).toContain(
      "cart_kit_share_is_checkout_ready(ci.kit_share_id, auth.uid(), ci.quantity)",
    );
    expect(migration0088).toMatch(
      /cart_kit_share_is_checkout_ready\(_item\.kit_share_id, auth\.uid\(\), _item\.quantity\)/,
    );
  });

  it("0091 replaces integer helper with numeric parameter (fixes 42883)", () => {
    expect(migration0091).toContain("_quantity numeric");
    expect(migration0091).toContain(
      "drop function if exists public.cart_kit_share_is_checkout_ready(uuid, uuid, integer)",
    );
    expect(migration0091).toContain(
      "revoke all on function public.cart_kit_share_is_checkout_ready(uuid, uuid, numeric)",
    );
    expect(migration0091).not.toMatch(
      /create or replace function public\.cart_kit_share_is_checkout_ready[\s\S]*_quantity integer/,
    );
  });

  it("0091 keeps participant quantity equality (integer kit qty compares to numeric safely)", () => {
    expect(migration0091).toContain("and ksp.quantity = _quantity");
  });
});
