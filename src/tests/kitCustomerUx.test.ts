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
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Kit verlassen");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Vials vergeben");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Du bist dabei!");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Passt alles?");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Mit diesem Anteil beitreten");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toContain("Kit Gesuch erstellen");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toContain("Was möchtest du mit anderen teilen?");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("useExchangeRate");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Dein Anteil:");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Kit gemeinsam kaufen");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Meine Kit Beteiligungen");
    expect(read("src/pages/GroupBuy.tsx")).toContain("+ Kit Gesuch");
    expect(read("src/pages/KitRequests.tsx")).toContain("+ Kit Gesuch");
    expect(read("src/pages/KitRequests.tsx")).toContain("parseAreaTheme");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Ja, Anteil freigeben");
    expect(read("src/pages/KitRequests.tsx")).toContain("Ja, Anteil freigeben");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Du hast das Kit verlassen.");
    expect(read("src/pages/KitRequests.tsx")).toContain("Du hast das Kit verlassen.");
  });
});
