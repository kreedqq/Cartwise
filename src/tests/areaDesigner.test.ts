import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AREA_THEME_PRESETS,
  EMPTY_AREA_THEME,
  improveThemeContrast,
  normalizeHexColor,
  paletteFromPrimary,
  parseAreaTheme,
} from "@/lib/shop/areaTheme";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("sales area designer", () => {
  it("uses a color picker instead of hex-only inputs", () => {
    const panel = read("src/components/admin/AreaDesignPanel.tsx");
    expect(panel).toContain('type="color"');
    expect(panel).toContain("Live Vorschau");
    expect(panel).toContain("Palette erzeugen");
    expect(panel).toContain("Kontrast verbessern");
    expect(panel).toContain("Du hast ungespeicherte Designänderungen.");
    expect(panel).toContain("width: 1440");
    expect(panel).toContain("width: 768");
    expect(panel).toContain("width: 390");
    expect(panel).toContain("DualCurrencyPrice");
    expect(panel).not.toContain("from(\"carts\")");
  });

  it("creates a new area empty, from file, template, or duplicate", () => {
    const dialog = read("src/components/admin/AdminCreateShopAreaDialog.tsx");
    expect(dialog).toContain("Leer erstellen");
    expect(dialog).toContain("Händlerdatei importieren");
    expect(dialog).toContain("Aus Vorlage erstellen");
    expect(dialog).toContain("Bestehenden Bereich duplizieren");
    expect(dialog).toContain("applyVendorCatalogFromFile");
    expect(dialog).toContain("ohne Masterprodukt");
  });

  it("builds a deterministic palette and can improve contrast", () => {
    expect(normalizeHexColor("#D4AF37")).toBe("#d4af37");
    const palette = paletteFromPrimary("#d4af37");
    expect(palette.primary).toBe("#d4af37");
    expect(palette.button).toBe("#d4af37");
    expect(palette.background).toBeTruthy();
    expect(AREA_THEME_PRESETS.accessories?.primary).toBe("#d4af37");
    const improved = improveThemeContrast({
      ...EMPTY_AREA_THEME,
      enabled: true,
      tokens: { button: "#f5e6a8", buttonText: "#f7f4ee" },
    });
    expect(improved.tokens.buttonText).toBe("#1a1408");
    expect(parseAreaTheme({ enabled: true, tokens: { primary: "#d4af37" } }).tokens.primary).toBe("#d4af37");
  });
});
