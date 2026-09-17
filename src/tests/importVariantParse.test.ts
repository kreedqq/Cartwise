import { describe, expect, it } from "vitest";

import { parseVariantPackString } from "@/lib/importVariantParse";
import { inferSheetColumns } from "@/lib/importColumnInference";

describe("importVariantParse", () => {
  it("parses mg*vials pack strings", () => {
    const result = parseVariantPackString("5mg*10vials");
    expect(result.dosageVial).toBe("5 mg × 10 Vials");
    expect(result.confidence).toBe("high");
  });

  it("parses ml pack strings", () => {
    const result = parseVariantPackString("3ml*10vials");
    expect(result.dosageVial).toContain("3 ml");
  });
});

describe("importColumnInference", () => {
  it("maps merchant headers to fields", () => {
    const headers = ["Artikelnummer", "Produktname", "Variante", "Preis USD"];
    const samples = [["KP10", "KPV", "10mg*10vials", "60.85"]];
    const result = inferSheetColumns(headers, samples);
    expect(result.mapping.some((f) => f === "code")).toBe(true);
    expect(result.mapping.some((f) => f === "name")).toBe(true);
  });
});
