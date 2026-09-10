import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_ART_AR,
  MAINTENANCE_ART_HEIGHT,
  MAINTENANCE_ART_SRC,
  MAINTENANCE_ART_WIDTH,
  MAINTENANCE_MOBILE_ART_AR,
  MAINTENANCE_MOBILE_ART_SRC,
  maintenanceArtLayout,
} from "@/lib/maintenanceArt";

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
  it("keeps the desktop artwork 16:9 and the mobile artwork 9:16", () => {
    expect(MAINTENANCE_ART_SRC).toBe("/maintenance-pause-4k.jpg");
    expect(MAINTENANCE_ART_WIDTH).toBe(3840);
    expect(MAINTENANCE_ART_HEIGHT).toBe(2160);
    expect(MAINTENANCE_ART_AR).toBeCloseTo(16 / 9, 3);
    expect(MAINTENANCE_MOBILE_ART_SRC).toBe("/maintenance-pause-mobile.jpg");
    expect(MAINTENANCE_MOBILE_ART_AR).toBeCloseTo(9 / 16, 3);
  });

  it.each(DESKTOP)("fills %i×%i with the 4K landscape artwork", (width, height) => {
    const layout = maintenanceArtLayout(width, height);
    expect(layout.src).toBe("/maintenance-pause-4k.jpg");
    expect(layout.mode).toBe("cover");
    expect(layout.useAmbience).toBe(false);
    expect(layout.visibleWidthFraction).toBeGreaterThanOrEqual(0.85);
    expect(layout.visibleHeightFraction).toBeGreaterThanOrEqual(0.85);
    expect(layout.backgroundSize).toBe("cover");
  });

  it.each(MOBILE)("uses the portrait artwork full-width on %i×%i", (width, height) => {
    const layout = maintenanceArtLayout(width, height);
    const drawnHeight = width / MAINTENANCE_MOBILE_ART_AR;
    expect(layout.src).toBe("/maintenance-pause-mobile.jpg");
    expect(layout.mode).toBe("mobile");
    expect(layout.useAmbience).toBe(drawnHeight < height - 4);
    expect(layout.visibleWidthFraction).toBe(1);
    expect(layout.visibleHeightFraction).toBe(1);
    expect(layout.backgroundSize).toBe("100% auto");
    expect(layout.backgroundPosition).toBe("center center");
  });
});
