import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AREA_THEME_PRESETS,
  COLOR_FIELD_LABELS,
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
    expect(panel).toContain("Grunddesign");
    expect(panel).toContain("Shop & Produkte");
    expect(panel).toContain("Kit Gesuche");
    expect(panel).toContain("Navigation & Layout");
    expect(panel).toContain("Passe Farben, Hintergrund und den allgemeinen Look dieses Verkaufsbereichs an.");
    expect(panel).toContain("Diese Gruppe betrifft nur Kit Gesuche");
    expect(panel).toContain("Kit Gesuch Vorschau");
    expect(panel).toContain("Palette aus Hauptfarbe");
    expect(panel).toContain("Verbessern");
    expect(panel).toContain("Mehr Einstellungen");
    expect(panel).toContain("Kit Gesuch");
    expect(panel).toContain("Join Dialog");
    expect(panel).toContain("COLOR_FIELD_LABELS");
    expect(panel).toContain("Du hast ungespeicherte Designänderungen.");
    expect(panel).toContain("width: 1440");
    expect(panel).toContain("width: 768");
    expect(panel).toContain("width: 390");
    expect(panel).toContain("DualCurrencyPrice");
    expect(panel).toContain("Hintergrund");
    expect(panel).toContain("Hero aktiv");
    expect(panel).toContain("uploadAreaDesignImage");
    expect(panel).toContain("Mitmachen");
    expect(panel).toContain("Button Form");
    const theme = read("src/lib/shop/areaTheme.ts");
    expect(theme).toContain("Eckig");
    expect(theme).toContain("Leicht abgerundet");
    expect(theme).toContain("Abgerundet");
    expect(theme).toContain("Pill");
    expect(panel).toContain("Primary Button");
    expect(panel).toContain("Secondary Button");
    expect(panel).toContain("Gesuch erstellen");
    expect(panel).toContain("AREA_BUTTON_RADIUS_OPTIONS");
    expect(panel).toContain("areaButtonRadiusCss(draft.buttons.radius)");
    expect(panel).toContain("Standard wiederherstellen");
    expect(panel).toContain("Änderungen verwerfen");
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
    expect(COLOR_FIELD_LABELS.primary).toBe("Hauptfarbe");
    expect(COLOR_FIELD_LABELS.price).toBe("Preis");
    expect(read("src/lib/shop/areaTheme.ts")).toContain("Hauptfarbe");
    const improved = improveThemeContrast({
      ...EMPTY_AREA_THEME,
      enabled: true,
      tokens: { button: "#f5e6a8", buttonText: "#f7f4ee" },
    });
    expect(improved.tokens.buttonText).toBe("#1a1408");
    expect(parseAreaTheme({ enabled: true, tokens: { primary: "#d4af37" } }).tokens.primary).toBe("#d4af37");
    expect(parseAreaTheme({}).background.mode).toBe("global");
    expect(parseAreaTheme({ hero: { enabled: true, title: "Zubehör" } }).hero.title).toBe("Zubehör");
    expect(parseAreaTheme({}).buttons.radius).toBe("md");
    expect(parseAreaTheme({ buttons: { radius: "full" } }).buttons.radius).toBe("full");
    expect(parseAreaTheme({ buttons: { radius: "none" } }).buttons.radius).toBe("none");
    expect(parseAreaTheme({ buttons: { radius: "lg" } }).buttons.radius).toBe("lg");
    expect(EMPTY_AREA_THEME.buttons.radius).toBe("md");
  });
});
