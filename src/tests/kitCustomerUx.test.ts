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
    expect(kitRequestCustomerStatusLabel("cancelled")).toBe("Abgebrochen");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain('kitRequestActionLabel("join")');
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("kitRequestActionLabel");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Kit verlassen");
    // "Vials vergeben" ARIA label now lives in KitProgress.tsx (the dedicated progress component)
    expect(read("src/components/kit-requests/KitProgress.tsx")).toContain("Vials vergeben");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Mitmachen");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Dein Gesamtpreis");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("Noch verfügbar");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toContain("Kit Gesuch erstellen");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).toContain("Welches Produkt möchtest du teilen?");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("useExchangeRate");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain('data-currency=eur');
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Dein Anteil");
    expect(read("src/pages/GroupBuy.tsx")).toContain("KIT_REQUEST_CARD_GRID");
    expect(read("src/pages/KitRequests.tsx")).toContain("KIT_REQUEST_CARD_GRID");
    expect(read("src/lib/kitRequests.ts")).toContain("overflow-x-auto");
    expect(read("src/pages/GroupBuy.tsx")).toContain("KIT_REQUEST_TABS_LIST_CLASS");
    expect(read("src/pages/GroupBuy.tsx")).toContain("KitAreaActionNav");
    expect(read("src/pages/GroupBuy.tsx")).toContain("KitMarketplaceHero");
    expect(read("src/pages/GroupBuy.tsx")).toContain("AREA_PAGE_CONTENT_SLOT");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain("Warenkorb");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain("KitAreaActionNav");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain("KitRequestHint");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain(
      "Teile ein Kit mit anderen Kunden und bezahle nur deinen Anteil.",
    );
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).not.toContain("Kit gemeinsam kaufen");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).not.toContain("rounded-xl border border-border bg-card");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Meine Kit Beteiligungen");
    expect(read("src/lib/kitRequests.ts")).toContain('KIT_REQUEST_CREATE_LABEL = "Gesuch erstellen"');
    expect(read("src/pages/GroupBuy.tsx")).toContain("CreateKitRequestButton");
    expect(read("src/pages/KitRequests.tsx")).toContain("CreateKitRequestButton");
    expect(read("src/components/kit-requests/KitRequestIntro.tsx")).toContain("KIT_REQUEST_CREATE_LABEL");
    expect(read("src/pages/GroupBuy.tsx")).not.toContain("+ Kit Gesuch");
    expect(read("src/pages/KitRequests.tsx")).not.toContain("+ Kit Gesuch");
    // Fraction is now rendered by KitProgress; card passes the raw data through as props
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("allocated={request.allocatedTotal}");
    expect(read("src/components/kit-requests/KitProgress.tsx")).toContain("{allocated}");
    expect(read("src/components/kit-requests/KitProgress.tsx")).toContain("{kitSize}");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Keine offenen Kit Gesuche");
    expect(read("src/pages/KitRequests.tsx")).toContain("Keine offenen Kit Gesuche");
    // "freie Plätze" wording is more descriptive than "Plätze" — updated label
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Noch ${request.remainingVials}");
    expect(read("src/pages/KitRequests.tsx")).toContain("parseAreaTheme");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Ja, Anteil freigeben");
    expect(read("src/pages/KitRequests.tsx")).toContain("Ja, Anteil freigeben");
    expect(read("src/pages/GroupBuy.tsx")).toContain("Du hast das Kit verlassen.");
    expect(read("src/pages/KitRequests.tsx")).toContain("Du hast das Kit verlassen.");
  });

  it("keeps kit gesuche filters and cards usable on mobile widths", () => {
    const filter = read("src/components/kit-requests/KitRequestFilterBar.tsx");
    const card = read("src/components/kit-requests/KitRequestCard.tsx");
    const designer = read("src/components/admin/AreaDesignPanel.tsx");
    expect(filter).toContain("grid-cols-1");
    expect(filter).toContain("min-h-11");
    expect(filter).toContain("sm:grid-cols-2");
    expect(filter).toContain("xl:grid-cols-4");
    expect(filter).toContain("Produkt suchen …");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("getProductUnitLabel");
    expect(read("src/pages/GroupBuy.tsx")).toContain("AREA_PAGE_RHYTHM");
    expect(read("src/pages/GroupBuy.tsx")).toContain("KitMarketplaceHero");
    expect(card).toContain("min-h-11 w-full");
    expect(card).toContain("min-w-0");
    expect(read("src/lib/kitRequests.ts")).toContain("grid-cols-1");
    expect(read("src/lib/kitRequests.ts")).toContain("sm:grid-cols-2");
    expect(read("src/lib/kitRequests.ts")).toContain("xl:grid-cols-3");
    expect(designer).toContain("width: 375");
    expect(designer).toContain("width: 390");
    expect(designer).toContain("width: 412");
    expect(designer).toContain("width: 768");
    expect(designer).toContain("width: 1440");
  });
});
