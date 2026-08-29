import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("brand mark", () => {
  it("uses the original PEPTIX PNG asset without the old PX badge", () => {
    const brandMark = readFileSync(resolve(process.cwd(), "src/components/layout/BrandMark.tsx"), "utf8");
    expect(brandMark).toContain("/peptix-logo.png");
    expect(brandMark).not.toContain("/peptix-logo.svg");
    expect(brandMark).not.toContain(">PX<");
    expect(brandMark).toContain("toggleNavigation");
  });

  it("ships the unmodified original logo file in public/", () => {
    const logo = readFileSync(resolve(process.cwd(), "public/peptix-logo.png"));
    expect(logo.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    const width = logo.readUInt32BE(16);
    const height = logo.readUInt32BE(20);
    expect(width).toBe(2172);
    expect(height).toBe(724);
  });

  it("wires the logo as a navigation trigger in the app shell", () => {
    const appShell = readFileSync(resolve(process.cwd(), "src/components/layout/AppShell.tsx"), "utf8");
    const navProvider = readFileSync(resolve(process.cwd(), "src/context/NavShellProvider.tsx"), "utf8");
    expect(appShell).toContain("NavShellProvider");
    expect(appShell).toContain("MobileNavDrawer");
    expect(navProvider).toContain("toggleNavigation");
  });
});
