import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { APP_NAME, BRAND_NAME } from "@/lib/constants";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|html|css)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("Peptix branding", () => {
  it("uses Peptix as the visible product name", () => {
    expect(BRAND_NAME).toBe("Peptix");
    expect(APP_NAME).toBe("Peptix");
  });

  it("does not show Cartwise in frontend UI files", () => {
    const roots = ["src/pages", "src/components", "src/lib/constants.ts", "index.html"].map((p) =>
      resolve(process.cwd(), p),
    );
    const files = roots.flatMap((root) => (statSync(root).isDirectory() ? walk(root) : [root]));
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/Cartwise/.test(text)) hits.push(file.replace(process.cwd(), ""));
    }
    expect(hits).toEqual([]);
  });

  it("ships the Peptix brand artwork for the auth layout", () => {
    const image = statSync(resolve(process.cwd(), "public/peptix-brand.jpg"));
    expect(image.size).toBeGreaterThan(10_000);
  });
});
