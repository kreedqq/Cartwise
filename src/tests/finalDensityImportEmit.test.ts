import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { inferenceSummary } from "@/lib/importColumnInference";
import { summarizeReviewRows, toReviewRows } from "@/lib/importReview";
import { parseProductCsv } from "@/services/csvProducts";
import { parseVendorCatalogFile } from "@/services/vendorCatalogImport";

const OUT = resolve(process.cwd(), "supabase/qa/.generated/import-metrics-temp.json");

describe("final QA import metrics emit", () => {
  it.skipIf(process.env.FINAL_QA_EMIT !== "1")("writes Emma snippet metrics for browser QA script", async () => {

    const emmaCsv = [
      "Code,Name,Variante,Preis",
      "KP10,KPV,10mg*10vials,60.85",
      "BA3,BAC Water,3ml*10vials,5.00",
      "BA10,BAC Water,10ml*10vials,7.00",
    ].join("\n");

    const parsed = parseProductCsv(emmaCsv);
    const vendorParsed = await parseVendorCatalogFile(
      new File([emmaCsv], "emma-snippet.csv", { type: "text/csv" }),
    );
    const reviewRows = toReviewRows(parsed.rows, new Map());
    const summary = summarizeReviewRows(reviewRows);

    mkdirSync(resolve(process.cwd(), "supabase/qa/.generated"), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          rowsDetected: parsed.rows.length,
          unknownHeaders: parsed.unknownHeaders,
          columnsInferred: inferenceSummary(parsed.inference.columns).recognizedFields,
          reviewColumns: inferenceSummary(parsed.inference.columns).reviewColumns,
          applicable: summary.applicable,
          errors: summary.error,
          kp10: parsed.rows.find((r) => r.parsedCode === "KP10"),
          ba3: parsed.rows.find((r) => r.parsedCode === "BA3"),
          vendorUsesSameMapping:
            vendorParsed.inference.mapping.join(",") === parsed.inference.mapping.join(","),
          vendorRowCount: vendorParsed.rows.length,
        },
        null,
        2,
      ),
    );

    expect(parsed.rows).toHaveLength(3);
  });
});
