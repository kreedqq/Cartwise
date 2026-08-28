import {
  UNMAP_PREFIX_CODES,
  UNRESOLVED_PRODUCT_MAPPINGS,
} from "@/lib/peptide/persistence/explicitProductMappings";
import { emptyEquivalent, sameOrder, sameSet, textsEqual, textsFormatOnly } from "@/lib/peptide/persistence/dualRead/empty";
import { LEXICON_STATUS_FILTERS, matchesLexiconStatus } from "@/lib/peptide/lexiconFilters";
import { matchesSubstanceSearch } from "@/lib/peptide/search";
import { isCommunitySource, PEPTIDE_CATEGORIES, type PeptideCategory, type SourceType } from "@/lib/peptide/types";
import { isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import type {
  DualReadCounts,
  DualReadDifference,
  DualReadFamily,
  DualReadReport,
  DualReadVerdict,
  NormalizedIdentity,
  NormalizedResearchSnapshot,
} from "@/lib/peptide/persistence/dualRead/types";
import { HUDSON_NCTS, KNOWN_UNRESOLVED_REGULATORY } from "@/lib/peptide/persistence/dualRead/types";
import { lexiconDisplaySource } from "@/lib/peptide/persistence/researchDbMode";

const SEARCH_QUERIES = [
  "Reta",
  "Retatrutide",
  "LY3437943",
  "Tirze",
  "Tirzepatide",
  "Semax",
  "Selank",
  "MOTS-c",
  "TB-500",
  "Thymosin Beta-4",
] as const;

const INTEGRATION_SLUGS = [
  "retatrutide",
  "tirzepatide",
  "semaglutide",
  "orforglipron",
  "tb-500",
  "thymosin-beta-4",
  "melanotan-ii",
  "igf-1-lr3",
  "glow-blend",
] as const;

function emptyCounts(): DualReadCounts {
  return {
    MATCH: 0,
    ORDER_ONLY: 0,
    FORMAT_ONLY: 0,
    MISSING: 0,
    EXTRA: 0,
    DIFFERENT: 0,
    UNRESOLVED: 0,
  };
}

function markCritical(family: DualReadFamily, status: DualReadDifference["status"]): boolean {
  if (status === "MATCH" || status === "ORDER_ONLY" || status === "FORMAT_ONLY" || status === "UNRESOLVED") {
    return false;
  }
  if (family === "productMapping" && status !== "DIFFERENT") return false;
  return (
    family === "identity" ||
    family === "claim" ||
    family === "source" ||
    family === "study" ||
    family === "regulatory" ||
    family === "evidence" ||
    family === "hudson" ||
    family === "community" ||
    family === "productMapping"
  );
}

function push(
  diffs: DualReadDifference[],
  family: DualReadFamily,
  status: DualReadDifference["status"],
  key: string,
  legacyRef: string,
  postgresRef: string,
  note: string,
): void {
  diffs.push({
    family,
    status,
    key,
    legacyRef,
    postgresRef,
    note,
    critical: markCritical(family, status),
  });
}

function compareKeyed<T>(
  diffs: DualReadDifference[],
  family: DualReadFamily,
  legacy: T[],
  postgres: T[],
  keyOf: (row: T) => string,
  equal: (a: T, b: T) => { status: DualReadDifference["status"]; note: string },
): void {
  const left = new Map(legacy.map((row) => [keyOf(row), row]));
  const right = new Map(postgres.map((row) => [keyOf(row), row]));
  for (const key of left.keys()) {
    const a = left.get(key)!;
    const b = right.get(key);
    if (!b) {
      push(diffs, family, "MISSING", key, key, "(none)", "present in legacy, missing in postgres");
      continue;
    }
    const result = equal(a, b);
    push(diffs, family, result.status, key, key, key, result.note);
  }
  for (const key of right.keys()) {
    if (!left.has(key)) {
      push(diffs, family, "EXTRA", key, "(none)", key, "present in postgres, missing in legacy");
    }
  }
}

function identityEqual(a: NormalizedIdentity, b: NormalizedIdentity): { status: DualReadDifference["status"]; note: string } {
  const core =
    a.slug === b.slug &&
    a.name === b.name &&
    a.displayName === b.displayName &&
    a.category === b.category &&
    a.lifecycleStatus === b.lifecycleStatus &&
    sameSet(a.blendComponentSlugs, b.blendComponentSlugs) &&
    textsEqual(a.moleculeType, b.moleculeType) &&
    textsEqual(a.identityNote, b.identityNote);
  const aliases = sameSet(a.aliases, b.aliases) && sameSet(a.developmentNames, b.developmentNames);
  if (core && aliases && textsEqual(a.casNumber, b.casNumber) && textsEqual(a.chemicalClass, b.chemicalClass)) {
    if (!sameOrder(a.aliases, b.aliases) || !sameOrder(a.developmentNames, b.developmentNames)) {
      return { status: "ORDER_ONLY", note: "alias order differs" };
    }
    return { status: "MATCH", note: "identity fields match" };
  }
  if (core && aliases) {
    return { status: "FORMAT_ONLY", note: "overlay CAS/class lives on published.json, not substances" };
  }
  if (!aliases && core) return { status: "DIFFERENT", note: "alias set differs" };
  return { status: "DIFFERENT", note: "identity fields differ" };
}

function unresolvedProduct(code: string): boolean {
  const upper = code.trim().toUpperCase();
  return (
    UNRESOLVED_PRODUCT_MAPPINGS.some((row) => row.code.toUpperCase() === upper) ||
    UNMAP_PREFIX_CODES.some((row) => row.toUpperCase() === upper)
  );
}

function searchSlugs(snapshot: NormalizedResearchSnapshot, query: string): string[] {
  return snapshot.identities
    .filter((item) =>
      matchesSubstanceSearch(
        {
          name: item.name,
          displayName: item.displayName,
          aliases: item.aliases,
          developmentNames: item.developmentNames,
          slug: item.slug,
          category: item.category,
          casNumber: item.casNumber,
        },
        query,
      ),
    )
    .map((item) => item.slug)
    .sort();
}

function filterSlugs(
  snapshot: NormalizedResearchSnapshot,
  category: PeptideCategory | "all",
  status: (typeof LEXICON_STATUS_FILTERS)[number]["id"],
): string[] {
  return snapshot.listItems
    .filter((item) => (category === "all" || item.category === category) && matchesLexiconStatus(item, status))
    .map((item) => item.slug)
    .sort();
}

function hudsonHits(snapshot: NormalizedResearchSnapshot): string[] {
  const hits: string[] = [];
  for (const source of snapshot.sources) {
    if (isExcludedNct(source.nctId) || HUDSON_NCTS.some((nct) => source.legacyIds.some((id) => id.includes(nct)))) {
      hits.push(`source:${source.key}`);
    }
  }
  for (const study of snapshot.studies) {
    if (isExcludedNct(study.nctId)) hits.push(`study:${study.nctId}`);
  }
  for (const claim of snapshot.claims) {
    if (claim.nctIds.some((nct) => isExcludedNct(nct))) hits.push(`claim:${claim.stableKey}`);
  }
  return hits;
}

function communityHits(snapshot: NormalizedResearchSnapshot): string[] {
  const hits: string[] = [];
  for (const source of snapshot.sources) {
    if (isCommunitySource(source.sourceType as SourceType)) hits.push(`source:${source.key}`);
  }
  if (snapshot.communityReports.length) hits.push("communityReports");
  return hits;
}

export function compareResearchSnapshots(
  legacy: NormalizedResearchSnapshot,
  postgres: NormalizedResearchSnapshot,
  extras?: { fallback?: DualReadReport["fallback"]; fallbackMessage?: string | null; mode?: DualReadReport["mode"] },
): DualReadReport {
  const diffs: DualReadDifference[] = [];

  compareKeyed(diffs, "identity", legacy.identities, postgres.identities, (row) => row.slug, identityEqual);

  const aliasKey = (slug: string, alias: string, kind: string) => `${slug}::${alias}::${kind}`;
  const legacyAliases = legacy.identities.flatMap((row) => [
    ...row.aliases.map((alias) => aliasKey(row.slug, alias, "common_name")),
    ...row.developmentNames.map((alias) => aliasKey(row.slug, alias, "development_name")),
  ]);
  const postgresAliases = postgres.identities.flatMap((row) => [
    ...row.aliases.map((alias) => aliasKey(row.slug, alias, "common_name")),
    ...row.developmentNames.map((alias) => aliasKey(row.slug, alias, "development_name")),
  ]);
  for (const key of legacyAliases) {
    push(diffs, "alias", postgresAliases.includes(key) ? "MATCH" : "MISSING", key, key, key, "alias");
  }
  for (const key of postgresAliases) {
    if (!legacyAliases.includes(key)) push(diffs, "alias", "EXTRA", key, "(none)", key, "alias");
  }

  compareKeyed(
    diffs,
    "source",
    legacy.sources,
    postgres.sources,
    (row) => row.key,
    (a, b) => {
      if (a.pmid === b.pmid && a.doi === b.doi && a.nctId === b.nctId && textsEqual(a.title, b.title)) {
        return { status: "MATCH", note: "source identifiers match" };
      }
      if (a.pmid === b.pmid && a.doi === b.doi && a.nctId === b.nctId && textsFormatOnly(a.title, b.title)) {
        return { status: "FORMAT_ONLY", note: "title capitalization" };
      }
      return { status: "DIFFERENT", note: "source fields differ" };
    },
  );
  compareKeyed(
    diffs,
    "source",
    legacy.sourceAttachments,
    postgres.sourceAttachments,
    (row) => `${row.substanceSlug}:${row.legacySourceId}`,
    () => ({ status: "MATCH", note: "source attachment" }),
  );

  compareKeyed(
    diffs,
    "study",
    legacy.studies,
    postgres.studies,
    (row) => row.nctId,
    (a, b) => {
      if (textsEqual(a.title, b.title) && textsEqual(a.sponsor, b.sponsor) && textsEqual(a.phase, b.phase) && textsEqual(a.status, b.status)) {
        return { status: "MATCH", note: "study fields match" };
      }
      if (textsFormatOnly(a.title, b.title)) return { status: "FORMAT_ONLY", note: "study title formatting" };
      return { status: "DIFFERENT", note: "study fields differ" };
    },
  );
  compareKeyed(
    diffs,
    "study",
    legacy.studyAttachments,
    postgres.studyAttachments,
    (row) => `${row.substanceSlug}:${row.nctId}`,
    () => ({ status: "MATCH", note: "study attachment" }),
  );

  compareKeyed(
    diffs,
    "claim",
    legacy.claims,
    postgres.claims,
    (row) => row.stableKey,
    (a, b) => {
      if (a.claimType !== b.claimType || a.substanceSlug !== b.substanceSlug) {
        return { status: "DIFFERENT", note: "claim type or substance" };
      }
      if (!textsEqual(a.statement, b.statement)) return { status: "DIFFERENT", note: "claim text" };
      if (!sameSet(a.sourceLegacyIds, b.sourceLegacyIds)) {
        return { status: "DIFFERENT", note: "claim source ids" };
      }
      if (!sameOrder(a.sourceLegacyIds, b.sourceLegacyIds)) return { status: "ORDER_ONLY", note: "source id order" };
      return { status: "MATCH", note: "claim slot" };
    },
  );

  compareKeyed(
    diffs,
    "evidence",
    legacy.evidence,
    postgres.evidence,
    (row) => row.stableKey,
    (a, b) => {
      if (a.overlay !== b.overlay) return { status: "DIFFERENT", note: "overlay flag" };
      if (a.reviewStatus !== b.reviewStatus) return { status: "DIFFERENT", note: "evidence review status" };
      if (a.overlay && a.evidenceLevel !== b.evidenceLevel) return { status: "DIFFERENT", note: "overlay A-F" };
      if (emptyEquivalent(a.evidenceLevel, b.evidenceLevel) && emptyEquivalent(a.confidence, b.confidence)) {
        return { status: "MATCH", note: "review-required assessment" };
      }
      if (a.evidenceLevel === b.evidenceLevel && a.confidence === b.confidence && a.evidenceType === b.evidenceType) {
        return { status: "MATCH", note: "evidence assessment" };
      }
      return { status: "DIFFERENT", note: "evidence fields" };
    },
  );

  compareKeyed(
    diffs,
    "regulatory",
    legacy.regulatory,
    postgres.regulatory,
    (row) => row.stableKey,
    (a, b) => {
      if (KNOWN_UNRESOLVED_REGULATORY.includes(a.stableKey as (typeof KNOWN_UNRESOLVED_REGULATORY)[number])) {
        return { status: "UNRESOLVED", note: "documented unresolved regulatory row" };
      }
      if (
        a.authority === b.authority &&
        a.region === b.region &&
        a.status === b.status &&
        a.isCurrent === b.isCurrent &&
        textsEqual(a.applicationId, b.applicationId) &&
        textsEqual(a.productName, b.productName)
      ) {
        return { status: "MATCH", note: "regulatory record" };
      }
      if (a.status !== b.status) return { status: "DIFFERENT", note: "regulatory status" };
      return { status: "DIFFERENT", note: "regulatory fields" };
    },
  );

  compareKeyed(
    diffs,
    "review",
    legacy.reviewActions,
    postgres.reviewActions,
    (row) => `${row.entityStableKey}:${row.reason}`,
    (a, b) => (a.action === b.action ? { status: "MATCH", note: "review action" } : { status: "DIFFERENT", note: "review action" }),
  );

  compareKeyed(
    diffs,
    "productMapping",
    legacy.productMaps,
    postgres.productMaps,
    (row) => row.code.toUpperCase(),
    (a, b) => {
      if (unresolvedProduct(a.code)) {
        return { status: "UNRESOLVED", note: "documented unresolved SKU; not auto-mapped" };
      }
      if (a.slug === b.slug) return { status: "MATCH", note: "client mapper vs product_substances" };
      if (a.slug && b.slug && a.slug !== b.slug) {
        return { status: "DIFFERENT", note: `client=${a.slug} postgres=${b.slug}` };
      }
      return { status: "UNRESOLVED", note: `client fuzzy vs postgres explicit; client=${a.slug ?? "none"} postgres=${b.slug ?? "none"}` };
    },
  );

  for (const query of SEARCH_QUERIES) {
    const left = searchSlugs(legacy, query);
    const right = searchSlugs(postgres, query);
    if (sameSet(left, right)) {
      push(
        diffs,
        "search",
        sameOrder(left, right) ? "MATCH" : "ORDER_ONLY",
        `search:${query}`,
        left.join(","),
        right.join(","),
        "search slugs",
      );
    } else {
      push(diffs, "search", "DIFFERENT", `search:${query}`, left.join(","), right.join(","), "search slug set");
    }
  }

  for (const category of ["all", ...PEPTIDE_CATEGORIES] as Array<PeptideCategory | "all">) {
    for (const status of LEXICON_STATUS_FILTERS) {
      const left = filterSlugs(legacy, category, status.id);
      const right = filterSlugs(postgres, category, status.id);
      if (left.length === 0 && right.length === 0) continue;
      const key = `filter:${category}:${status.id}`;
      if (sameSet(left, right)) {
        push(diffs, "filter", sameOrder(left, right) ? "MATCH" : "ORDER_ONLY", key, left.join(","), right.join(","), "filter slugs");
      } else {
        push(diffs, "filter", "DIFFERENT", key, left.join(","), right.join(","), "filter slug set");
      }
    }
  }

  for (const slug of INTEGRATION_SLUGS) {
    const a = legacy.details.find((row) => row.slug === slug);
    const b = postgres.details.find((row) => row.slug === slug);
    if (!a || !b) {
      push(diffs, "detail", a ? "MISSING" : "EXTRA", slug, a?.slug ?? "(none)", b?.slug ?? "(none)", "detail profile");
      continue;
    }
    const slots: Array<[DualReadFamily, string, string]> = [
      ["mechanism", a.mechanism, b.mechanism],
      ["effects", a.effects, b.effects],
      ["safety", a.safety, b.safety],
    ];
    if (textsEqual(a.overview, b.overview)) push(diffs, "detail", "MATCH", `${slug}:overview`, slug, slug, "overview");
    else push(diffs, "detail", "DIFFERENT", `${slug}:overview`, slug, slug, "overview text");
    for (const [family, left, right] of slots) {
      push(diffs, family, textsEqual(left, right) ? "MATCH" : "DIFFERENT", `${slug}:${family}`, slug, slug, family);
    }
    if (sameSet(a.interactions, b.interactions)) {
      push(diffs, "interactions", sameOrder(a.interactions, b.interactions) ? "MATCH" : "ORDER_ONLY", `${slug}:interactions`, slug, slug, "interactions");
    } else {
      push(diffs, "interactions", "DIFFERENT", `${slug}:interactions`, slug, slug, "interactions");
    }
    if (textsEqual(a.reconstitution, b.reconstitution)) {
      push(diffs, "reconstitution", "MATCH", `${slug}:reconstitution`, slug, slug, "reconstitution");
    } else {
      push(diffs, "reconstitution", "DIFFERENT", `${slug}:reconstitution`, slug, slug, "reconstitution");
    }
    if (sameSet(a.studyNcts, b.studyNcts)) {
      push(diffs, "study", sameOrder(a.studyNcts, b.studyNcts) ? "MATCH" : "ORDER_ONLY", `${slug}:studies`, slug, slug, "detail studies");
    } else {
      push(diffs, "study", "DIFFERENT", `${slug}:studies`, a.studyNcts.join(","), b.studyNcts.join(","), "detail studies");
    }
    if (sameSet(a.sourceLegacyIds, b.sourceLegacyIds)) {
      push(diffs, "source", sameOrder(a.sourceLegacyIds, b.sourceLegacyIds) ? "MATCH" : "ORDER_ONLY", `${slug}:sources`, slug, slug, "detail sources");
    } else {
      push(diffs, "source", "DIFFERENT", `${slug}:sources`, a.sourceLegacyIds.join(","), b.sourceLegacyIds.join(","), "detail sources");
    }
    if (a.evidenceLevel === b.evidenceLevel) {
      push(diffs, "evidence", "MATCH", `${slug}:evidence`, String(a.evidenceLevel), String(b.evidenceLevel), "detail evidence");
    } else {
      push(diffs, "evidence", "DIFFERENT", `${slug}:evidence`, String(a.evidenceLevel), String(b.evidenceLevel), "detail evidence");
    }
  }

  const leftHudson = hudsonHits(legacy);
  const rightHudson = hudsonHits(postgres);
  if (leftHudson.length === 0 && rightHudson.length === 0) {
    push(diffs, "hudson", "MATCH", "hudson", "0", "0", "no Hudson NCT entities");
  } else {
    push(diffs, "hudson", "DIFFERENT", "hudson", leftHudson.join(","), rightHudson.join(","), "Hudson NCT leakage");
  }

  const leftCommunity = communityHits(legacy);
  const rightCommunity = communityHits(postgres);
  if (leftCommunity.length === 0 && rightCommunity.length === 0) {
    push(diffs, "community", "MATCH", "community", "0", "0", "community unavailable");
  } else {
    push(diffs, "community", "DIFFERENT", "community", leftCommunity.join(","), rightCommunity.join(","), "community leakage");
  }

  const counts = emptyCounts();
  for (const diff of diffs) counts[diff.status] += 1;
  const criticalCount = diffs.filter((row) => row.critical).length;
  const fallback = extras?.fallback ?? null;
  const verdict: DualReadVerdict =
    criticalCount === 0 && fallback == null ? "DUAL_READ_READY" : "DUAL_READ_NOT_READY";

  return {
    mode: extras?.mode ?? "dual",
    displaySource: lexiconDisplaySource({ VITE_RESEARCH_DB_MODE: extras?.mode ?? "dual" }),
    fallback,
    fallbackMessage: extras?.fallbackMessage ?? null,
    differences: diffs,
    counts,
    criticalCount,
    verdict: fallback ? "DUAL_READ_NOT_READY" : verdict,
    totals: {
      substances: postgres.identities.length,
      aliases: postgres.identities.reduce((sum, row) => sum + row.aliases.length + row.developmentNames.length, 0),
      sourceAttachments: postgres.sourceAttachments.length,
      uniqueSources: postgres.sources.length,
      studyAttachments: postgres.studyAttachments.length,
      uniqueStudies: postgres.studies.length,
      claims: postgres.claims.length,
      evidence: postgres.evidence.length,
      overlayEvidence: postgres.evidence.filter((row) => row.overlay).length,
      reviewRequiredEvidence: postgres.evidence.filter((row) => row.reviewStatus === "review-required").length,
      regulatory: postgres.regulatory.length,
      reviewActions: postgres.reviewActions.length,
      communityReports: 0,
    },
  };
}

export { SEARCH_QUERIES, INTEGRATION_SLUGS, searchSlugs, filterSlugs };
