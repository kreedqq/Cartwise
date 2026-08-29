import { rejectClinicalTrial, normalizeClinicalTrial, validateClinicalTrialRecord } from "@/lib/peptide/research/updateEngine/clinicalTrials";
import { normalizeEmaResult, validateEmaRecord } from "@/lib/peptide/research/updateEngine/ema";
import { normalizeFdaResult, validateFdaRecord } from "@/lib/peptide/research/updateEngine/fda";
import { normalizePubmedArticle, validatePubmedRecord } from "@/lib/peptide/research/updateEngine/pubmed";
import { withRateLimit, type RetryOptions } from "@/lib/peptide/research/updateEngine/rateLimit";
import type {
  ConnectorSearchResult,
  ConnectorSourceRecord,
  SubstanceIdentityRow,
  UpdateEngineConnector,
} from "@/lib/peptide/research/updateEngine/types";

const DEFAULT_RETRY: RetryOptions = { minIntervalMs: 350, maxRetries: 2, backoffMs: 400 };

export function scientificAdapter(input: {
  id: UpdateEngineConnector["id"];
  label: string;
  search: (substance: SubstanceIdentityRow) => Promise<unknown[] | ConnectorSearchResult>;
  retry?: RetryOptions;
}): UpdateEngineConnector {
  return {
    id: input.id,
    label: input.label,
    kind: "scientific",
    availability: "available",
    cannotRaiseEvidence: false,
    async search({ substance, now }): Promise<ConnectorSearchResult> {
      const payload = await withRateLimit(input.id, () => input.search(substance), input.retry ?? DEFAULT_RETRY);
      if (payload && typeof payload === "object" && "ok" in payload && "records" in payload) {
        return payload as ConnectorSearchResult;
      }
      const rows = Array.isArray(payload) ? payload : [];
      const records: ConnectorSourceRecord[] = [];
      const normalizeRaw = (raw: unknown) => {
        if (input.id === "pubmed") return normalizePubmedArticle(raw, { slug: substance.slug, now });
        if (input.id === "clinicaltrials") return normalizeClinicalTrial(raw, { slug: substance.slug, now });
        if (input.id === "fda") {
          const result = normalizeFdaResult(raw, { slug: substance.slug, now });
          return result.kind === "record" ? result.record : null;
        }
        if (input.id === "ema") {
          const result = normalizeEmaResult(raw, { slug: substance.slug, now });
          return result.kind === "record" ? result.record : null;
        }
        return null;
      };
      for (const raw of rows) {
        const normalized = normalizeRaw(raw);
        if (normalized) records.push(normalized);
      }
      return { ok: true, availability: "available", records };
    },
    normalize(raw, context) {
      if (input.id === "pubmed") return normalizePubmedArticle(raw, context);
      if (input.id === "clinicaltrials") return normalizeClinicalTrial(raw, context);
      if (input.id === "fda") {
        const result = normalizeFdaResult(raw, context);
        return result.kind === "record" ? result.record : null;
      }
      if (input.id === "ema") {
        const result = normalizeEmaResult(raw, context);
        return result.kind === "record" ? result.record : null;
      }
      return null;
    },
    validate(record) {
      if (input.id === "pubmed") return validatePubmedRecord(record);
      if (input.id === "clinicaltrials") {
        const base = validateClinicalTrialRecord(record);
        if (!base.ok) return base;
        const rejected = rejectClinicalTrial(record.substanceCandidate ?? "", record);
        return rejected ? { ok: false, message: rejected } : { ok: true };
      }
      if (input.id === "fda") return validateFdaRecord(record);
      if (input.id === "ema") return validateEmaRecord(record);
      return { ok: false, message: "unknown-connector" };
    },
  };
}
