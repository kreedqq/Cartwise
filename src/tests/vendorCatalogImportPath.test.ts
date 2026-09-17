import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("vendor catalog import path", () => {
  it("uses shared intelligent CSV/XLSX parsers, not legacy", () => {
    const src = readFileSync(resolve(process.cwd(), "src/services/vendorCatalogImport.ts"), "utf8");
    expect(src).toContain("parseProductCsv");
    expect(src).toContain("parseProductXlsx");
    expect(src).toContain("VENDOR_CATALOG_ANALYZE");
    expect(src).not.toContain("parseProductCsvLegacy");
    expect(src).not.toContain("parseProductXlsxLegacy");
  });
});
