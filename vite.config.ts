/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Pages project sites are served from /<repo-name>/. The build
// workflow (.github/workflows/deploy.yml) sets VITE_BASE_PATH to that value.
// Local dev and Supabase-only deployments default to "/".
const basePath = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    // Scoped to the real source tree so a stray copy of the project inside the
    // working directory can never be picked up as a second, stale test suite.
    // Local Supabase QA lives in *.qa.test.ts and runs only via npm run test:qa.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/tests/qa/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
    // Windows / constrained CI: too many fork workers time out before they boot.
    maxWorkers: 2,
  },
});
