import { describe, expect, it } from "vitest";

import {
  assertSafeLocalQaTarget,
  findProductionQaMarker,
  isLocalSupabaseUrl,
} from "@/lib/qa/productionGuard";

describe("productionGuard", () => {
  it("detects production markers", () => {
    expect(findProductionQaMarker("https://cnjrjinvxycdkrmzcime.supabase.co")).toBe(
      "cnjrjinvxycdkrmzcime",
    );
    expect(findProductionQaMarker("postgresql://x@db.cartwise-prod.supabase.co/postgres")).toBe(
      "cartwise-prod",
    );
    expect(isLocalSupabaseUrl("http://127.0.0.1:55421")).toBe(true);
    expect(isLocalSupabaseUrl("https://cnjrjinvxycdkrmzcime.supabase.co")).toBe(false);
  });

  it("aborts non-local QA targets", () => {
    expect(() =>
      assertSafeLocalQaTarget({ supabaseUrl: "https://cnjrjinvxycdkrmzcime.supabase.co" }),
    ).toThrow(/QA TEST ABORT/);
    expect(() => assertSafeLocalQaTarget({ supabaseUrl: "https://example.com" })).toThrow(
      /QA TEST ABORT/,
    );
    expect(() => assertSafeLocalQaTarget({ supabaseUrl: "http://127.0.0.1:55421" })).not.toThrow();
  });
});
