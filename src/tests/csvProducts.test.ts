import { describe, expect, it } from "vitest";

import { CSV_HEADERS, buildProductCsvTemplate, exportProductsToCsv, parseProductCsv } from "@/services/csvProducts";
import type { Tables } from "@/types/database";

function product(overrides: Partial<Tables<"products">> = {}): Tables<"products"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code: "ART-5001",
    name: "Beispielpräparat A",
    description: null,
    dosage_vial: "10 mg / Vial",
    category: "Präparate",
    price_usd: 60,
    bulk_price_usd: 55,
    bulk_price_min_quantity: 10,
    currency: "USD",
    is_active: true,
    last_price_change_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CSV_HEADERS", () => {
  it("covers every importable field", () => {
    expect(CSV_HEADERS).toEqual([
      "code",
      "name",
      "dosage_vial",
      "price_usd",
      "bulk_price_usd",
      "bulk_price_min_quantity",
      "category",
      "description",
      "is_active",
    ]);
  });
});

describe("exportProductsToCsv", () => {
  it("writes the header and all product fields", () => {
    const csv = exportProductsToCsv([product()]);
    expect(csv.split(/\r?\n/)[0]).toBe(CSV_HEADERS.join(","));
    expect(csv).toContain("10 mg / Vial");
    expect(csv).toContain("55");
  });

  it("writes an empty cell - not 0 - for a product without a bulk tier", () => {
    const csv = exportProductsToCsv([product({ bulk_price_usd: null, bulk_price_min_quantity: null })]);
    const dataRow = csv.split(/\r?\n/)[1];
    expect(dataRow).toContain("60,,");
  });
});

describe("parseProductCsv", () => {
  it("round-trips an exported catalog without losing a single field", () => {
    const original = product();
    const parsed = parseProductCsv(exportProductsToCsv([original]));

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      parsedCode: original.code,
      parsedName: original.name,
      parsedDosageVial: original.dosage_vial,
      parsedPriceUsd: original.price_usd,
      parsedBulkPriceUsd: original.bulk_price_usd,
      parsedBulkPriceMinQuantity: original.bulk_price_min_quantity,
      parsedCategory: original.category,
      parsedIsActive: true,
      quality: "ok",
    });
  });

  it("round-trips a product without a bulk tier", () => {
    const parsed = parseProductCsv(
      exportProductsToCsv([product({ bulk_price_usd: null, bulk_price_min_quantity: null })]),
    );
    expect(parsed.rows[0].parsedBulkPriceUsd).toBeNull();
    expect(parsed.rows[0].parsedBulkPriceMinQuantity).toBeNull();
    expect(parsed.rows[0].quality).toBe("ok");
  });

  it("round-trips an inactive product as is_active = false", () => {
    const parsed = parseProductCsv(exportProductsToCsv([product({ is_active: false })]));
    expect(parsed.rows[0].parsedIsActive).toBe(false);
  });

  it("accepts German column titles in any order", () => {
    const csv = [
      "Artikelcode;Bezeichnung;Dosage / Vial;Normalpreis;Mengenpreis;Mengenpreis ab;Kategorie;Status",
      "art-5001;Präparat A;10 mg / Vial;60,00;55,00;10;Präparate;aktiv",
    ].join("\n");

    const parsed = parseProductCsv(csv);
    expect(parsed.rows[0]).toMatchObject({
      parsedCode: "ART-5001",
      parsedPriceUsd: 60,
      parsedBulkPriceUsd: 55,
      parsedBulkPriceMinQuantity: 10,
      parsedIsActive: true,
      quality: "ok",
    });
  });

  it("flags a broken bulk pair as an error instead of importing half a tier", () => {
    const csv = ["code,name,price_usd,bulk_price_usd", "ART-1,Test,60,55"].join("\n");
    const parsed = parseProductCsv(csv);
    expect(parsed.rows[0].quality).toBe("error");
    expect(parsed.rows[0].qualityReason).toContain("Mengenpreis ab");
  });

  it("reports a column that will not be imported", () => {
    const csv = ["code,name,price_usd,Lieferant", "ART-1,Test,60,ACME"].join("\n");
    expect(parseProductCsv(csv).unknownHeaders).toEqual(["Lieferant"]);
  });

  it("returns no rows for a file without a recognisable header", () => {
    expect(parseProductCsv("ART-1,Test,60").rows).toEqual([]);
  });
});

describe("buildProductCsvTemplate", () => {
  it("produces a template that the importer accepts as-is", () => {
    const parsed = parseProductCsv(buildProductCsvTemplate());
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].quality).toBe("ok");
    expect(parsed.rows[0].parsedBulkPriceMinQuantity).toBe(10);
  });
});
