import { describe, expect, it } from "vitest";

import { aggregateHealthLevel, healthFromCounts, healthLabel } from "@/lib/admin/systemHealthStatus";

describe("systemHealthStatus", () => {
  it("aggregates worst level", () => {
    expect(aggregateHealthLevel(["healthy", "needs_attention"])).toBe("needs_attention");
    expect(aggregateHealthLevel(["healthy", "error"])).toBe("error");
  });

  it("maps counts and labels", () => {
    expect(healthFromCounts({ errors: 1 })).toBe("error");
    expect(healthFromCounts({ warnings: 2 })).toBe("needs_attention");
    expect(healthFromCounts({})).toBe("healthy");
    expect(healthLabel("healthy")).toBe("OK");
  });
});
