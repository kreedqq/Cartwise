import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";

import { DualCurrencyPrice } from "@/components/common/DualCurrencyPrice";
import { convertUsdToEur, formatEur, formatUsd } from "@/lib/money";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("DualCurrencyPrice", () => {
  it("renders EUR first and USD below from the existing converters", () => {
    const usd = 11.88;
    const rate = 0.862;
    const eur = convertUsdToEur(usd, rate);
    expect(eur).toBe(10.24);

    const { container } = render(<DualCurrencyPrice usd={usd} rate={rate} />);
    const root = screen.getByTestId("dual-currency-price");
    const eurNode = root.querySelector('[data-currency="eur"]');
    const usdNode = root.querySelector('[data-currency="usd"]');
    expect(root.children[0]?.getAttribute("data-currency")).toBe("eur");
    expect(root.children[1]?.getAttribute("data-currency")).toBe("usd");
    expect(eurNode?.textContent).toBe(formatEur(10.24));
    expect(usdNode?.textContent).toBe(formatUsd(11.88));
    expect(eurNode && usdNode && (eurNode.compareDocumentPosition(usdNode) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    expect(eurNode?.className).toContain("text-base");
    expect(usdNode?.className).toContain("text-xs");
    expect(container.textContent).toContain("€");
    expect(container.textContent).toContain("USD");
    expect(container.textContent).not.toMatch(/EUR 10,24|10,24 EUR/);
  });

  it("keeps precomputed EUR snapshots instead of converting again", () => {
    render(<DualCurrencyPrice usd={50} eur={40} rate={0.5} />);
    const root = screen.getByTestId("dual-currency-price");
    expect(root.querySelector('[data-currency="eur"]')?.textContent).toBe(formatEur(40));
    expect(root.querySelector('[data-currency="usd"]')?.textContent).toBe(formatUsd(50));
    expect(root.textContent).not.toContain(formatEur(25));
  });
});

describe("customer dual-currency surfaces", () => {
  it("uses DualCurrencyPrice in shop desktop and mobile", () => {
    const desktop = read("src/components/shop/ShopProductsTable.tsx");
    const mobile = read("src/components/shop/ShopProductsMobileList.tsx");
    expect(desktop).toContain("DualCurrencyPrice");
    expect(desktop).toContain("usd={product.price_usd}");
    expect(desktop).toContain("usd={product.bulk_price_usd}");
    expect(mobile).toContain("DualCurrencyPrice");
    expect(mobile).toContain("usd={product.price_usd}");
    expect(mobile).toContain("usd={product.bulk_price_usd}");
    expect(desktop.indexOf("usd={product.price_usd}")).toBeLessThan(desktop.indexOf("usd={product.bulk_price_usd}"));
    expect(desktop).not.toContain("formatUsd(product.price_usd)");
    expect(mobile).not.toContain("formatUsd(product.price_usd)");
  });

  it("keeps one shared shop table for retail and both group buys", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/shop"');
    expect(app).toContain("ShopHubPage");
    expect(app).toContain('path="/shop/:slug"');
    expect(app).toContain("ShopAreaPage");
    expect(read("src/pages/ShopRetail.tsx")).toContain("ShopProductsTable");
    expect(read("src/pages/ShopRetail.tsx")).toContain("ShopProductsMobileList");
    expect(read("src/pages/GroupBuy.tsx")).toContain("ShopProductsTable");
    expect(read("src/pages/GroupBuy.tsx")).toContain("ShopProductsMobileList");
    expect(read("src/pages/GroupBuy.tsx")).toContain("group_buy");
  });

  it("uses DualCurrencyPrice in cart unit prices, totals, dashboard, and checkout", () => {
    expect(read("src/components/cart/CartItemsTable.tsx")).toContain("usd={item.unit_price_usd_snapshot}");
    expect(read("src/components/cart/CartItemsMobileList.tsx")).toContain("usd={item.unit_price_usd_snapshot}");
    expect(read("src/components/cart/CartCard.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/cart/CartSummaryBar.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/cart/CartSummaryPanel.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/pages/Checkout.tsx")).toContain("usd={item.unit_price_usd_snapshot}");
    expect(read("src/pages/admin/AdminShopAreas.tsx")).not.toContain("DualCurrencyPrice");
  });

  it("uses DualCurrencyPrice for customer kit prices", () => {
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/shop/KitShareDialog.tsx")).toContain("DualCurrencyPrice");
    expect(read("src/components/kit-requests/KitRequestCard.tsx")).not.toContain("formatUsd");
    expect(read("src/components/kit-requests/JoinKitRequestDialog.tsx")).not.toContain("formatUsd");
    expect(read("src/components/shop/KitShareDialog.tsx")).not.toContain("formatUsd(");
    expect(read("src/pages/Checkout.tsx")).not.toContain("formatUsd(eligibleTotals");
  });
});
