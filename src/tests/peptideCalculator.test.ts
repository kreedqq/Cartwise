import { describe, expect, it } from "vitest";

import {
  calculateConcentration,
  calculateReconstitution,
  calculateVials,
  convertMassUnits,
  iuConversionUnavailable,
} from "@/lib/peptide/calculator";

describe("peptide calculator", () => {
  it("computes reconstitution concentration and volume", () => {
    const result = calculateReconstitution({
      vialAmount: 10,
      vialUnit: "mg",
      solventMl: 2,
      desiredAmount: 250,
      desiredUnit: "mcg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.concentrationMgPerMl).toBe(5);
    expect(result.concentrationMcgPerMl).toBe(5000);
    expect(result.volumeMl).toBeCloseTo(0.05);
    expect(result.disclaimer).toMatch(/mathematisches Ergebnis/i);
    expect(result.disclaimer).not.toMatch(/Du solltest/i);
  });

  it("rejects zero solvent and negative values", () => {
    expect(
      calculateReconstitution({
        vialAmount: 10,
        vialUnit: "mg",
        solventMl: 0,
        desiredAmount: 1,
        desiredUnit: "mg",
      }).ok,
    ).toBe(false);
    expect(
      calculateConcentration({ mass: -1, massUnit: "mg", volumeMl: 1 }).ok,
    ).toBe(false);
  });

  it("converts mass units without inventing IU", () => {
    const result = convertMassUnits({ amount: 1, from: "mg", to: "mcg" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(1000);
    expect(iuConversionUnavailable().message).toMatch(/IU/i);
  });

  it("rounds vial counts up", () => {
    const result = calculateVials({
      vialAmount: 10,
      vialUnit: "mg",
      neededAmount: 25,
      neededUnit: "mg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vialsExact).toBe(2.5);
    expect(result.vialsRoundedUp).toBe(3);
  });
});
