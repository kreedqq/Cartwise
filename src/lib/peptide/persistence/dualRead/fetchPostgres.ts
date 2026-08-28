import type { PostgresResearchBundle } from "@/lib/peptide/persistence/dualRead/bundle";
import type { DualReadFallbackKind } from "@/lib/peptide/persistence/dualRead/types";

export interface ResearchSelectError {
  message: string;
  code?: string;
}

export interface ResearchSelectClient {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{ data: unknown[] | null; error: ResearchSelectError | null }>;
  };
}

export type FetchPostgresResult =
  | { ok: true; bundle: PostgresResearchBundle }
  | { ok: false; kind: Exclude<DualReadFallbackKind, null>; message: string };

const DEFAULT_TIMEOUT_MS = 12_000;

function classifyError(error: { message: string; code?: string; name?: string }): Exclude<DualReadFallbackKind, null> {
  const message = error.message.toLowerCase();
  const code = (error.code ?? "").toUpperCase();
  if (error.name === "AbortError" || message.includes("timeout") || message.includes("aborted")) return "timeout";
  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied") || message.includes("rls")) {
    return "rls";
  }
  if (message.includes("failed to fetch") || message.includes("network") || message.includes("offline")) return "network";
  return "query";
}

async function selectRows<T>(
  client: ResearchSelectClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const { data, error } = await client.from(table).select(columns);
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }
  return (data ?? []) as T[];
}

export async function fetchPostgresResearch(
  client: ResearchSelectClient,
  options: { timeoutMs?: number } = {},
): Promise<FetchPostgresResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const work = (async (): Promise<PostgresResearchBundle> => {
    const substances = await selectRows<PostgresResearchBundle["substances"][number]>(
      client,
      "substances",
      "id, slug, name, display_name, category, molecule_type, chemical_class, cas_number, identity_note, status",
    );
    const aliases = await selectRows<PostgresResearchBundle["aliases"][number]>(
      client,
      "substance_aliases",
      "substance_id, alias, alias_type",
    );
    const components = await selectRows<PostgresResearchBundle["components"][number]>(
      client,
      "substance_components",
      "blend_id, component_id, sort_order",
    );
    const sources = await selectRows<PostgresResearchBundle["sources"][number]>(
      client,
      "sources",
      "id, source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id, legacy_ids",
    );
    const sourceSubstances = await selectRows<PostgresResearchBundle["sourceSubstances"][number]>(
      client,
      "source_substances",
      "source_id, substance_id, legacy_source_id",
    );
    const studies = await selectRows<PostgresResearchBundle["studies"][number]>(
      client,
      "studies",
      "id, nct_id, title, sponsor, phase, status, enrollment, start_date, completion_date, last_updated, has_results, source_url",
    );
    const studySubstances = await selectRows<PostgresResearchBundle["studySubstances"][number]>(
      client,
      "study_substances",
      "study_id, substance_id",
    );
    const claims = await selectRows<PostgresResearchBundle["claims"][number]>(
      client,
      "claims",
      "id, stable_key, substance_id, claim_type, statement, status",
    );
    const claimSources = await selectRows<PostgresResearchBundle["claimSources"][number]>(
      client,
      "claim_sources",
      "claim_id, source_id, study_id",
    );
    const evidence = await selectRows<PostgresResearchBundle["evidence"][number]>(
      client,
      "evidence_assessments",
      "claim_id, evidence_level, confidence, evidence_type, review_status",
    );
    const regulatory = await selectRows<PostgresResearchBundle["regulatory"][number]>(
      client,
      "regulatory_records",
      "stable_key, substance_id, authority, region, status, indication, product_name, application_id, is_current, source_id",
    );
    const reviewActions = await selectRows<PostgresResearchBundle["reviewActions"][number]>(
      client,
      "review_actions",
      "entity_stable_key, action, reason",
    );

    let productMaps: PostgresResearchBundle["productMaps"] = [];
    try {
      const maps = await selectRows<{
        mapping_method: string;
        substances: { slug: string } | { slug: string }[] | null;
        products: { code: string; name: string } | { code: string; name: string }[] | null;
      }>(client, "product_substances", "mapping_method, substances(slug), products(code, name)");
      productMaps = maps.map((row) => {
        const substance = Array.isArray(row.substances) ? row.substances[0] : row.substances;
        const product = Array.isArray(row.products) ? row.products[0] : row.products;
        return {
          code: product?.code ?? "",
          name: product?.name ?? "",
          substance_slug: substance?.slug ?? null,
        };
      }).filter((row) => row.code);
    } catch {
      /* product join is optional; mapping comparison uses empty maps */
    }

    return {
      substances,
      aliases,
      components,
      productMaps,
      sources,
      sourceSubstances,
      studies,
      studySubstances,
      claims,
      claimSources,
      evidence,
      regulatory,
      reviewActions,
    };
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bundle = await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error("postgres research fetch timeout");
          err.name = "AbortError";
          reject(err);
        }, timeoutMs);
      }),
    ]);
    return { ok: true, bundle };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const kind = classifyError(err);
    return { ok: false, kind, message: err.message.slice(0, 200) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function mockSelectClient(tables: Record<string, unknown[]>): ResearchSelectClient {
  return {
    from(table: string) {
      return {
        select() {
          if (table in tables) return Promise.resolve({ data: tables[table], error: null });
          return Promise.resolve({ data: null, error: { message: `missing table ${table}`, code: "PGRST205" } });
        },
      };
    },
  };
}

export function failingSelectClient(kind: "timeout" | "rls" | "network" | "query"): ResearchSelectClient {
  return {
    from() {
      return {
        select() {
          if (kind === "timeout") {
            return new Promise(() => undefined);
          }
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
