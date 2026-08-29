import type { DualReadFallbackKind } from "@/lib/peptide/persistence/dualRead/types";
import type { PublicLexiconBundle } from "@/lib/peptide/lexicon/types";

export interface PublicLexiconSelectError {
  message: string;
  code?: string;
}

export interface PublicLexiconSelectClient {
  from: (table: string) => {
    select: (
      columns: string,
      filters?: { eq?: Record<string, string> },
    ) => PromiseLike<{ data: unknown[] | null; error: PublicLexiconSelectError | null }>;
  };
}

export type FetchPublicLexiconResult =
  | { ok: true; bundle: PublicLexiconBundle }
  | { ok: false; kind: Exclude<DualReadFallbackKind, null>; message: string };

const DEFAULT_TIMEOUT_MS = 12_000;

function classifyError(error: { message: string; code?: string; name?: string }): Exclude<DualReadFallbackKind, null> {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toUpperCase();
  if (error.name === "AbortError" || message.includes("timeout") || message.includes("aborted")) return "timeout";
  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied") || message.includes("rls")) {
    return "rls";
  }
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("offline")) {
    return "network";
  }
  if (message.includes("invalid json") || message.includes("unexpected token") || message.includes("malformed")) {
    return "invalid";
  }
  if (message.includes("incomplete") || message.includes("partial")) return "partial";
  return "query";
}

async function selectRows<T>(
  client: PublicLexiconSelectClient,
  table: string,
  columns: string,
  filters?: { eq?: Record<string, string> },
): Promise<T[]> {
  const { data, error } = await client.from(table).select(columns, filters);
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }
  return (data ?? []) as T[];
}

/**
 * Public lexicon fetch. Does not select the review-actions table, regulatory history,
 * prices, or admin notes. Claims and evidence are filtered server-side.
 */
export async function fetchPublicLexicon(
  client: PublicLexiconSelectClient,
  options: { timeoutMs?: number } = {},
): Promise<FetchPublicLexiconResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const work = (async (): Promise<PublicLexiconBundle> => {
    const [
      substances,
      aliases,
      components,
      claims,
      claimSources,
      evidence,
      sources,
      sourceSubstances,
      studies,
      studySubstances,
      regulatory,
    ] = await Promise.all([
      selectRows<PublicLexiconBundle["substances"][number]>(
        client,
        "substances",
        "id, slug, name, display_name, category, molecule_type, chemical_class, cas_number, identity_note, status, updated_at",
      ),
      selectRows<PublicLexiconBundle["aliases"][number]>(
        client,
        "substance_aliases",
        "substance_id, alias, alias_type",
      ),
      selectRows<PublicLexiconBundle["components"][number]>(
        client,
        "substance_components",
        "blend_id, component_id, sort_order",
      ),
      selectRows<PublicLexiconBundle["claims"][number]>(
        client,
        "claims",
        "id, stable_key, substance_id, claim_type, statement, status, safety_category",
        { eq: { status: "approved" } },
      ),
      selectRows<PublicLexiconBundle["claimSources"][number]>(
        client,
        "claim_sources",
        "claim_id, source_id, study_id",
      ),
      selectRows<PublicLexiconBundle["evidence"][number]>(
        client,
        "evidence_assessments",
        "claim_id, evidence_level, confidence, evidence_type, review_status",
        { eq: { review_status: "approved" } },
      ),
      selectRows<PublicLexiconBundle["sources"][number]>(
        client,
        "sources",
        "id, source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id, legacy_ids, review_status, connector",
        { eq: { review_status: "approved" } },
      ),
      selectRows<PublicLexiconBundle["sourceSubstances"][number]>(
        client,
        "source_substances",
        "source_id, substance_id, legacy_source_id",
      ),
      selectRows<PublicLexiconBundle["studies"][number]>(
        client,
        "studies",
        "id, nct_id, title, sponsor, phase, status, enrollment, start_date, completion_date, last_updated, has_results, source_url, review_status, intervention, condition",
        { eq: { review_status: "approved" } },
      ),
      selectRows<PublicLexiconBundle["studySubstances"][number]>(
        client,
        "study_substances",
        "study_id, substance_id",
      ),
      selectRows<PublicLexiconBundle["regulatory"][number]>(
        client,
        "regulatory_records",
        "stable_key, substance_id, authority, region, status, indication, product_name, application_id, is_current, source_id, review_status",
      ),
    ]);

    let communityReports: NonNullable<PublicLexiconBundle["communityReports"]> = [];
    try {
      communityReports = await selectRows<NonNullable<PublicLexiconBundle["communityReports"]>[number]>(
        client,
        "community_reports",
        "id, substance_id, kind, title, content_summary, source_url, review_status",
        { eq: { review_status: "approved" } },
      );
    } catch {
      // Missing table or RLS: keep science bundle exclusive. Do not mix fallback.
    }

    return {
      substances,
      aliases,
      components,
      sources,
      sourceSubstances,
      studies,
      studySubstances,
      claims,
      claimSources,
      evidence,
      regulatory,
      communityReports,
    };
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bundle = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error("postgres public lexicon fetch timeout");
          err.name = "AbortError";
          reject(err);
        }, timeoutMs);
      }),
    ]);
    if (!Array.isArray(bundle.substances) || bundle.substances.length === 0) {
      return { ok: false, kind: "partial", message: "postgres public lexicon response incomplete" };
    }
    return { ok: true, bundle };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { ok: false, kind: classifyError(err), message: err.message.slice(0, 200) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function mockPublicSelectClient(tables: Record<string, unknown[]>): PublicLexiconSelectClient {
  return {
    from(table: string) {
      return {
        select(_columns: string, filters?: { eq?: Record<string, string> }) {
          if (!(table in tables)) {
            return Promise.resolve({ data: null, error: { message: `missing table ${table}`, code: "PGRST205" } });
          }
          let rows = tables[table] ?? [];
          if (filters?.eq) {
            rows = rows.filter((row) => {
              const record = row as Record<string, unknown>;
              return Object.entries(filters.eq ?? {}).every(([key, value]) => String(record[key] ?? "") === value);
            });
          }
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
  };
}

export function failingPublicSelectClient(
  kind: "timeout" | "rls" | "network" | "query",
): PublicLexiconSelectClient {
  return {
    from() {
      return {
        select() {
          if (kind === "timeout") return new Promise(() => undefined);
          const messages = {
            rls: { message: "permission denied for table evidence_assessments", code: "42501" },
            network: { message: "Failed to fetch", code: "NETWORK" },
            query: { message: "column does not exist", code: "42703" },
          } as const;
          return Promise.resolve({ data: null, error: messages[kind] });
        },
      };
    },
  };
}
