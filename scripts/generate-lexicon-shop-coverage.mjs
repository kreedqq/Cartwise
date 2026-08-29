import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
  configFile: resolve(root, "vite.config.ts"),
  logLevel: "error",
});

try {
  const mod = await server.ssrLoadModule("/src/lib/peptide/shopCoverage/generateDocs.ts");
  const { csvPath, mdPath, summary } = mod.generateLexiconShopCoverageDocs(root);
  console.log(mod.coverageReportText(summary));
  console.log("");
  console.log(`CSV: ${csvPath}`);
  console.log(`MD:  ${mdPath}`);
} finally {
  await server.close();
}
