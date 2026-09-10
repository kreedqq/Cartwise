import { describe, expect, it } from "vitest";

import { MAINTENANCE_ART_AR, MAINTENANCE_ART_HEIGHT, MAINTENANCE_ART_SRC, MAINTENANCE_ART_WIDTH, maintenanceArtLayout } from "@/lib/maintenanceArt";

const DESKTOP = [
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
] as const;

const MOBILE = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [393, 873],
  [412, 915],
  [430, 932],
  [412, 710],
] as const;

describe("maintenanceArtLayout", () => {
  it("keeps the source artwork 16:9", () => {
    expect(MAINTENANCE_ART_SRC).toBe("/maintenance-pause-4k.jpg");
    expect(MAINTENANCE_ART_WIDTH).toBe(3840);
    expect(MAINTENANCE_ART_HEIGHT).toBe(2160);
    expect(MAINTENANCE_ART_AR).toBeCloseTo(16 / 9, 3);
  });

  it.each(DESKTOP)("fills %i×%i without extreme cropping", (width, height) => {
    const layout = maintenanceArtLayout(width, height);
    expect(layout.mode).toBe("cover");
    expect(layout.useAmbience).toBe(false);
    expect(layout.visibleWidthFraction).toBeGreaterThanOrEqual(0.85);
    expect(layout.visibleHeightFraction).toBeGreaterThanOrEqual(0.85);
    expect(layout.backgroundSize).toBe("cover");
  });

  it.each(MOBILE)("keeps most of the 16:9 frame on %i×%i", (width, height) => {
    const layout = maintenanceArtLayout(width, height);
    expect(layout.mode).toBe("width");
    expect(layout.useAmbience).toBe(true);
    expect(layout.visibleWidthFraction).toBe(1);
    expect(layout.visibleHeightFraction).toBe(1);
    expect(layout.backgroundSize).toBe("100% auto");
    expect(layout.backgroundSize).not.toBe("cover");
  });
});
