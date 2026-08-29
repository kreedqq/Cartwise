import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { buildBatch03IntakePlan, type Batch03AnalysisFile } from "@/lib/peptide/research/batch03Intake";
import { renderBatch03IntakeSql } from "@/lib/peptide/research/batch03Persist";

const analysis = JSON.parse(
  readFileSync(resolve(process.cwd(), "src/research/cache/fetched/batch03/analysis.json"), "utf8"),
) as Batch03AnalysisFile;
const sql = renderBatch03IntakeSql(buildBatch03IntakePlan(analysis));
const out = process.argv[2] ?? resolve(process.cwd(), "scripts/sql/batch03-review-intake-import.sql");
writeFileSync(out, sql, "utf8");
console.log(`wrote ${out} (${sql.length} bytes)`);
