/// <reference types="vitest/config" />
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local isolated QA suite only. Default `npm test` excludes these files.
 * Requires PEPTIX_QA_LOCAL=1 and a running local supabase (via npm run test:qa).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    include: ["src/tests/qa/**/*.qa.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/qa/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
