import { describe, expect, it } from "vitest";

import { VENDOR_PDF_UNREADABLE } from "@/lib/shop/vendorCatalog";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";

describe("parseVendorCatalogFile", () => {
  it("parses a CSV dealer file through the existing table parser", async () => {
    const file = new File(
      ["code,name,price_usd,Lieferant\nSM5,Semax,80,Emma\nUNKNOWN,X,10,Emma\n"],
      "shop.csv",
      { type: "text/csv" },
    );
    const parsed = await parseVendorCatalogFile(file);
    expect(parsed.kind).toBe("csv");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.parsedCode).toBe("SM5");
    expect(parsed.rows[0]?.parsedPriceUsd).toBe(80);
    expect(parsed.rows[0]?.extraFields).toEqual({ Lieferant: "Emma" });
  });

  it("rejects an empty CSV instead of inventing rows", async () => {
    const file = new File(["keine tabelle"], "leer.csv", { type: "text/csv" });
    await expect(parseVendorCatalogFile(file)).rejects.toThrow(/Keine Datenzeilen/);
  });

  it("uses the shared unreadable-PDF message", () => {
    expect(VENDOR_PDF_UNREADABLE).toBe(
      "Die Produktdaten konnten aus dieser PDF nicht eindeutig erkannt werden. Bitte CSV oder Excel verwenden.",
    );
  });
});
