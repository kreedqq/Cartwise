import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("brand mark", () => {
  it("uses the PEPTIX logo asset without the old PX badge", () => {
    const brandMark = readFileSync(resolve(process.cwd(), "src/components/layout/BrandMark.tsx"), "utf8");
    expect(brandMark).toContain("/peptix-logo.svg");
    expect(brandMark).not.toContain(">PX<");
    expect(brandMark).toContain("toggleNavigation");
  });

  it("wires the logo as a navigation trigger in the app shell", () => {
    const appShell = readFileSync(resolve(process.cwd(), "src/components/layout/AppShell.tsx"), "utf8");
    const navProvider = readFileSync(resolve(process.cwd(), "src/context/NavShellProvider.tsx"), "utf8");
    expect(appShell).toContain("NavShellProvider");
    expect(appShell).toContain("MobileNavDrawer");
    expect(navProvider).toContain("toggleNavigation");
  });
});
