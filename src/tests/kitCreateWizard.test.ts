import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyRoleMarkup, convertUsdToEur } from "@/lib/money";
import { isValidCreatorQuantity, remainingQuantityOptions } from "@/lib/kitRequests";
import { kitShareParticipantBaseUsd, kitShareParticipantPriceUsd } from "@/lib/shop/kitSharePricing";
import { KIT_SIZE_OPTIONS, isValidKitSize } from "@/lib/shop/kitUnits";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("kit create wizard", () => {
  const wizard = read("src/components/kit-requests/CreateKitRequestDialog.tsx");
  const shopTable = read("src/components/shop/ShopProductsTable.tsx");
  const shopMobile = read("src/components/shop/ShopProductsMobileList.tsx");
  const createSql = read("supabase/migrations/0052_shop_area_product_config.sql");

  it("walks one customer decision per step and keeps everyday language", () => {
    expect(wizard).toContain("Schritt {step + 1} von {STEPS.length}");
    expect(wizard).toContain("Was möchtest du mit anderen teilen?");
    expect(wizard).toContain("Suche nach einem Produkt oder wähle eines aus.");
    expect(wizard).toContain("Produkt suchen …");
    expect(wizard).toContain("shopGroupMatchesSearch");
    expect(wizard).toContain("kitRequestableVariants");
    expect(wizard).toContain("useKitRequestableProductIds");
    expect(wizard).toContain("Mehr anzeigen");
    expect(wizard).toContain("KIT_WIZARD_PRODUCT_PAGE_SIZE");
    expect(wizard).toContain("Welche Variante möchtest du?");
    expect(wizard).toContain("Wie groß soll das gemeinsame Kit sein?");
    expect(wizard).toContain("Wie viele möchtest du selbst übernehmen?");
    expect(wizard).toContain("Möchtest du etwas dazuschreiben?");
    expect(wizard).toContain("Fast geschafft");
    expect(wizard).toContain("Dein voraussichtlicher Anteil");
    expect(wizard).toContain("Kit Gesuch erstellen");
    expect(wizard).toContain("Kit Gesuch erstellt");
    expect(wizard).toContain("z. B. bevorzugte Aufteilung");
    expect(wizard).toContain("Du übernimmst:");
    expect(wizard).toContain("Noch gesucht:");
    expect(wizard).not.toContain("remaining_quantity");
    expect(wizard).not.toContain("7/9 Kit");
    expect(wizard).not.toContain("create_kit_share");
    expect(wizard).not.toContain("sync_completed_kit_request_carts");
    expect(wizard).not.toContain("useSyncKitRequestCarts");
    expect(wizard).not.toContain("Adamax");
    expect(wizard).not.toContain("AD10");
  });

  it("preselects a shop product and still uses create_kit_request", () => {
    expect(wizard).toContain("initialProductId");
    expect(wizard).toContain("useCreateKitRequest");
    expect(wizard).toContain("group.groupKey");
    expect(wizard).toContain("shopArea");
    expect(wizard).toContain("isValidCreatorQuantity");
    expect(wizard).toContain("KIT_SIZE_OPTIONS");
    expect(shopTable).toContain("CreateKitRequestDialog");
    expect(shopTable).toContain("initialProductId={kitProductId}");
    expect(shopTable).not.toMatch(/<KitShareDialog/);
    expect(shopMobile).toContain("CreateKitRequestDialog");
    expect(shopMobile).not.toMatch(/<KitShareDialog/);
    expect(read("src/components/shop/KitShareDialog.tsx")).toContain("+ Kit Gesuch");
  });

  it("keeps creator quantity and kit size on the existing engine", () => {
    expect(isValidKitSize(10)).toBe(true);
    expect(KIT_SIZE_OPTIONS).toContain(10);
    expect(isValidCreatorQuantity(10, 3)).toBe(true);
    expect(isValidCreatorQuantity(10, 10)).toBe(false);
    expect(isValidCreatorQuantity(10, 0)).toBe(false);
    expect(remainingQuantityOptions(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(remainingQuantityOptions(0)).toEqual([]);
  });

  it("does not synchronize carts when an open request is created", () => {
    const createFn = createSql.slice(createSql.indexOf("create or replace function public.create_kit_request"));
    const nextFn = createFn.slice(0, createFn.indexOf("create or replace function public.list_open_kit_requests"));
    expect(nextFn).toContain("is_open_request");
    expect(nextFn).toContain("status");
    expect(nextFn).toContain("'open'");
    expect(nextFn).not.toContain("sync_completed_kit_request_carts");
    expect(nextFn).not.toContain("kit_share_sync_all_participant_carts");
    expect(read("src/pages/GroupBuy.tsx")).toContain("useSyncKitRequestCarts");
    expect(read("src/pages/GroupBuy.tsx")).toContain("request.id");
    expect(read("src/components/kit-requests/CreateKitRequestDialog.tsx")).not.toContain("useSyncKitRequestCarts");
  });
});

describe("kit join and leave customer copy", () => {
  it("keeps join on preview_kit_request_join and join_kit_request", () => {
    const join = read("src/components/kit-requests/JoinKitRequestDialog.tsx");
    expect(join).toContain("previewKitRequestJoin");
    expect(join).toContain("useJoinKitRequest");
    expect(join).toContain("remainingQuantityOptions");
    expect(join).toContain("Du bist dabei!");
    expect(join).toContain("Passt alles?");
    expect(join).toContain("Mit diesem Anteil beitreten");
    expect(join).toContain("DualCurrencyPrice");
    expect(join).not.toContain("create_kit_share");
  });

  it("explains leave without technical status values", () => {
    const groupBuy = read("src/pages/GroupBuy.tsx");
    const kitRequests = read("src/pages/KitRequests.tsx");
    expect(groupBuy).toContain("Möchtest du deinen Anteil wieder freigeben?");
    expect(kitRequests).toContain("Möchtest du deinen Anteil wieder freigeben?");
    expect(groupBuy).toContain("Ja, Anteil freigeben");
    expect(kitRequests).toContain("Ja, Anteil freigeben");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("Kit verlassen");
  });
});

describe("shop kit entry no longer uses invite-kit sync errors", () => {
  it("keeps the invite dialog for cart edits but does not map 42501 to a fake sync failure", () => {
    const dialog = read("src/components/shop/KitShareDialog.tsx");
    expect(dialog).not.toContain("Der Kit Anteil konnte nicht synchronisiert werden.");
    expect(dialog).toContain("Das hat leider nicht funktioniert. Dein Kit wurde nicht verändert.");
    expect(read("src/components/shop/EditKitShareButton.tsx")).toContain("KitShareDialog");
    expect(read("src/components/cart/CartItemsTable.tsx")).toContain("EditKitShareButton");
  });
});

describe("shop layout uses available desktop width", () => {
  it("widens the shell, search, and shop columns without a mobile page overflow", () => {
    expect(read("src/components/layout/AppShell.tsx")).toContain("max-w-[1680px]");
    expect(read("src/pages/GroupBuy.tsx")).toContain("w-full max-w-3xl");
    expect(read("src/pages/ShopRetail.tsx")).toContain("w-full max-w-3xl");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("min-w-[16rem]");
    expect(read("src/components/shop/ShopProductsTable.tsx")).toContain("In den Warenkorb");
    expect(read("src/components/shop/ShopProductsMobileList.tsx")).toContain("min-h-11 w-full");
    expect(read("src/components/shop/ShopProductsMobileList.tsx")).not.toContain("min-w-[9.5rem]");
    expect(read("src/components/layout/MobileNav.tsx")).toContain("useCustomerNavItems");
  });
});

describe("kit create wizard share preview uses kit pricing SSoT", () => {
  const wizard = read("src/components/kit-requests/CreateKitRequestDialog.tsx");
  const kitSize = 10;
  /** Shop-listed peptide `price_usd` is the sell price of one 10-vial kit (factor + markup already applied). */
  const shopSellKitUsd = 73.28;
  const shopPeptide = { category: "PEPTIDES", price_usd: shopSellKitUsd };

  it("splits the shop kit sell price instead of treating it as a vial price", () => {
    expect(wizard).toContain("kitShareParticipantBaseUsd");
    expect(wizard).toContain("sharePriceUsd");
    expect(wizard).not.toContain("price_usd * creatorQuantity");
    expect(wizard).not.toContain("kitShareParticipantPriceUsd");
    expect(wizard).not.toContain("applyRoleMarkup");
    expect(wizard).toContain("useCreateKitRequest");
    expect(wizard).not.toMatch(/mutateAsync\(\{[^}]*price/);
  });

  it.each([
    [1, 7.33],
    [2, 14.66],
    [5, 36.64],
    [6, 43.97],
    [9, 65.95],
    [10, 73.28],
  ] as const)("kit 10 / share %i of shop kit %s USD", (shareQuantity, expectedShareUsd) => {
    const shareUsd = kitShareParticipantBaseUsd(
      shopPeptide,
      kitSize,
      shareQuantity,
      shareQuantity,
    );
    expect(shareUsd).toBeCloseTo(expectedShareUsd, 2);
    expect(shareUsd).toBeCloseTo((shopSellKitUsd * shareQuantity) / kitSize, 2);
    expect(shareUsd).not.toBeCloseTo(shopSellKitUsd * shareQuantity, 2);
  });

  it("does not apply role markup a second time on an already-sold shop kit price", () => {
    const catalogKitUsd = 100;
    const markupPercent = 25;
    const shopSellKit = {
      category: "PEPTIDES",
      price_usd: applyRoleMarkup(catalogKitUsd, markupPercent),
    };
    expect(shopSellKit.price_usd).toBe(125);
    const shareUsd = kitShareParticipantBaseUsd(shopSellKit, kitSize, 6, 6);
    expect(shareUsd).toBe(75);
    expect(applyRoleMarkup(shareUsd, markupPercent)).toBe(93.75);
    expect(kitShareParticipantPriceUsd(shopSellKit, kitSize, 6, 6, markupPercent)).toBe(93.75);
    expect(shareUsd).not.toBe(93.75);
  });

  it("converts the share USD to EUR once through the central rate", () => {
    const shareUsd = kitShareParticipantBaseUsd(shopPeptide, kitSize, 6, 6);
    const rate = 0.86;
    const shareEur = convertUsdToEur(shareUsd, rate);
    expect(shareUsd).toBe(43.97);
    expect(shareEur).toBe(37.81);
    expect(convertUsdToEur(shareUsd, 63.22 / 73.28)).toBe(37.93);
    expect(shareEur).not.toBeNull();
    expect(convertUsdToEur(shareEur as number, rate)).toBe(32.52);
    expect(convertUsdToEur(shareEur as number, rate)).not.toBe(shareEur);
    expect(wizard).toContain("DualCurrencyPrice");
    expect(wizard).toContain("useExchangeRate");
    expect(wizard).toContain("usd={sharePriceUsd}");
    expect(wizard).not.toContain("convertEurToUsd");
    expect(wizard).not.toContain("convertUsdToEur(");
  });

  it("keeps join preview on the same participant-share SSoT", () => {
    const join = read("src/components/kit-requests/JoinKitRequestDialog.tsx");
    const previewSql = read("supabase/migrations/0052_shop_area_product_config.sql");
    const previewFn = previewSql.slice(previewSql.indexOf("create or replace function public.preview_kit_request_join"));
    expect(join).toContain("previewKitRequestJoin");
    expect(previewFn).toContain("kit_share_participant_base_usd");
    expect(previewFn).toContain("apply_role_markup");
    expect(previewFn.match(/apply_role_markup/g)?.length).toBe(1);
  });
});
