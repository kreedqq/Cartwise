import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { kitRequestCustomerStatusLabel } from "@/lib/kitRequests";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("kit customer UX", () => {
  it("uses understandable labels and EUR-first prices", () => {
    expect(kitRequestCustomerStatusLabel("open", 1)).toBe("Fast voll");
    expect(kitRequestCustomerStatusLabel("full")).toBe("Voll");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Mitmachen");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Kit teilen");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Kit gemeinsam kaufen");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Meine Kit Beteiligungen");
    expect(read("src/pages/KitRequests.tsx")).toContain("parseAreaTheme");
  });
});
