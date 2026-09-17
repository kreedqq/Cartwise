import { describe, expect, it } from "vitest";

import { VENDOR_CATALOG_ANALYZE } from "@/lib/importAnalyze";
import { inferenceSummary } from "@/lib/importColumnInference";
import { matchVendorCatalogRows } from "@/lib/shop/vendorCatalog";
import { parseProductCsv } from "@/services/csvProducts";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";

function csvFile(name: string, text: string): File {
  return new File([text], name, { type: "text/csv" });
}

describe("intelligent import — multilingual column layouts", () => {
  it("File A: Code / Produkt / Variante / Preis USD / Kategorie", () => {
    const csv = [
      "Code,Produkt,Variante,Preis USD,Kategorie",
      "ART-1,Test Peptide,5mg*10vials,42.5,Peptide",
    ].join("\n");
    const parsed = parseProductCsv(csv);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].parsedCode).toBe("ART-1");
    expect(parsed.rows[0].parsedName).toBe("Test Peptide");
    expect(parsed.rows[0].parsedPriceUsd).toBe(42.5);
    expect(parsed.rows[0].parsedCategory).toBe("Peptide");
    expect(inferenceSummary(parsed.inference.columns).recognizedFields).toBeGreaterThanOrEqual(4);
  });

  it("File B: Abkürzung / Peptide / variant column / Preis pro 10erKit in $", () => {
    const csv = [
      "Abkürzung,Peptide,Variante,Preis pro 10erKit in $",
      "KP10,KPV,10mg*10vials,60.85",
    ].join("\n");
    const parsed = parseProductCsv(csv);
    expect(parsed.rows[0]).toMatchObject({
      parsedCode: "KP10",
      parsedName: "KPV",
      parsedPriceUsd: 60.85,
    });
    expect(parsed.rows[0].parsedDosageVial).toMatch(/10.*vial/i);
  });

  it("File C: SKU / Name / Dosage / Vial / Normalpreis / Kategorie", () => {
    const csv = [
      "SKU,Name,Dosage / Vial,Normalpreis,Kategorie",
      "BA3,BAC Water,3ml*10vials,5.00,Supplies",
    ].join("\n");
    const parsed = parseProductCsv(csv);
    expect(parsed.rows[0].parsedCode).toBe("BA3");
    expect(parsed.rows[0].parsedName).toBe("BAC Water");
    expect(parsed.rows[0].parsedPriceUsd).toBe(5);
  });

  it("File D: Product Code / Product / Specification / Price / Currency (unknown)", () => {
    const csv = [
      "Product Code,Product,Specification,Price,Currency",
      "KP10,KPV,10mg*10vials,60.85,USD",
    ].join("\n");
    const parsed = parseProductCsv(csv);
    expect(parsed.rows[0].parsedCode).toBe("KP10");
    expect(parsed.rows[0].parsedName).toBe("KPV");
    expect(parsed.rows[0].parsedPriceUsd).toBe(60.85);
    expect(parsed.unknownHeaders.some((h) => /currency/i.test(h))).toBe(true);
  });

  it("PEPTIX/Emma-style rows via vendor shared analyzer (raw pack strings)", async () => {
    const csv = [
      "Code,Name,Variante,Preis",
      "KP10,KPV,10mg*10vials,60.85",
      "BA3,BAC Water,3ml*10vials,5.00",
      "BA10,BAC Water,10ml*10vials,7.00",
    ].join("\n");
    const parsed = await parseVendorCatalogFile(csvFile("emma-snippet.csv", csv));
    expect(parsed.inference.columns.filter((c) => c.assignedField).length).toBeGreaterThanOrEqual(3);
    const { matched } = matchVendorCatalogRows(parsed.rows, []);
    expect(matched.find((r) => r.code === "KP10")).toMatchObject({
      name: "KPV",
      dosage_vial: "10mg*10vials",
      price_usd: 60.85,
    });
    expect(matched.find((r) => r.code === "BA3")).toMatchObject({
      dosage_vial: "3ml*10vials",
      price_usd: 5,
    });
  });

  it("vendor and global share the same inference engine", async () => {
    const csv = "Code,Produkt,Variante,Preis USD\nX1,Alpha,2mg*10vials,10\n";
    const global = parseProductCsv(csv);
    const vendor = await parseVendorCatalogFile(csvFile("shared.csv", csv));
    expect(vendor.inference.mapping).toEqual(global.inference.mapping);
    expect(vendor.rows[0].parsedCode).toBe(global.rows[0].parsedCode);
    expect(parseProductCsv(csv, VENDOR_CATALOG_ANALYZE).rows[0].parsedDosageVial).toBe("2mg*10vials");
    expect(global.rows[0].parsedDosageVial).not.toBe("2mg*10vials");
  });
});
