/**
 * Batch 03 persist: idempotent, transactional, never auto-approve.
 * Does not talk to production. Used by tests and SQL rendering.
 */
import { identitySeedFromCatalog } from "@/lib/peptide/persistence/identitySeed";
import { isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import {
  identityIssueForCandidate,
  type Batch03IntakePlan,
  type IntakeSourceRow,
  type IntakeStudyRow,
} from "@/lib/peptide/research/batch03Intake";

export function createSeededPersistStore(): PersistStore {
  const science = publishedScienceSeed();
  const claims = publishedClaimsSeed();
  const regulatory = publishedRegulatorySeed();
  const substances = identitySeedFromCatalog().map((row) => ({ id: `sub:${row.slug}`, slug: row.slug }));
  const sourceIdByKey = new Map(science.sources.map((row) => [row.key, `source:${row.key}`]));
  const studyIdByNct = new Map(science.studies.map((row) => [row.nctId, `study:${row.nctId}`]));
  const substanceIdBySlug = new Map(substances.map((row) => [row.slug, row.id]));
  return {
    substances,
    sources: science.sources.map((row) => ({
      id: sourceIdByKey.get(row.key) ?? row.key,
      sourceType: row.sourceType,
      title: row.title,
      publisher: row.publisher,
      publicationDate: row.publicationDate,
      accessDate: row.accessDate,
      url: row.url,
      doi: row.doi,
      pmid: row.pmid,
      nctId: row.nctId,
      legacyIds: row.legacyIds,
      status: "active",
      reviewStatus: "approved",
      connector: null,
    })),
    sourceSubstances: science.sourceSubstances.flatMap((row) => {
      const sourceId = sourceIdByKey.get(row.sourceKey);
      const substanceIdValue = substanceIdBySlug.get(row.substanceSlug);
      if (!sourceId || !substanceIdValue) return [];
      return [{ sourceId, substanceId: substanceIdValue, legacySourceId: row.legacySourceId }];
    }),
    studies: science.studies.map((row) => ({
      id: studyIdByNct.get(row.nctId) ?? row.nctId,
      nctId: row.nctId,
      title: row.title,
      sponsor: row.sponsor,
      phase: row.phase,
      status: row.status,
      intervention: null,
      condition: null,
      sourceUrl: row.url,
      reviewStatus: "approved",
    })),
    studySubstances: science.studySubstances.flatMap((row) => {
      const studyId = studyIdByNct.get(row.nctId);
      const substanceIdValue = substanceIdBySlug.get(row.substanceSlug);
      if (!studyId || !substanceIdValue) return [];
      return [{ studyId, substanceId: substanceIdValue }];
    }),
    studySources: science.studySources.flatMap((row) => {
      const studyId = studyIdByNct.get(row.nctId);
      const sourceId = sourceIdByKey.get(row.sourceKey);
      if (!studyId || !sourceId) return [];
      return [{ studyId, sourceId }];
    }),
    claims: claims.claims.map((row) => ({ id: row.stableKey })),
    evidence: claims.evidenceAssessments.map((row) => ({
      claimId: row.stableKey,
      reviewStatus: row.reviewStatus,
    })),
    regulatory: regulatory.records.map((row) => ({ id: row.stableKey, reviewStatus: row.reviewStatus })),
    productSubstances: Array.from({ length: 93 }, (_, index) => ({ id: `map:${index}` })),
  };
}

export interface PersistSource {
  id: string;
  sourceType: string;
  title: string;
  publisher: string | null;
  publicationDate: string | null;
  accessDate: string | null;
  url: string;
  doi: string | null;
  pmid: string | null;
  nctId: string | null;
  legacyIds: string[];
  status: "active" | "superseded" | "unavailable" | "rejected";
  reviewStatus: "draft" | "review-required" | "approved" | "rejected";
  connector: string | null;
}

export interface PersistStudy {
  id: string;
  nctId: string;
  title: string;
  sponsor: string | null;
  phase: string | null;
  status: string | null;
  intervention: string | null;
  condition: string | null;
  sourceUrl: string;
  reviewStatus: "draft" | "review-required" | "approved" | "rejected";
}

export interface PersistStore {
  substances: Array<{ id: string; slug: string }>;
  sources: PersistSource[];
  sourceSubstances: Array<{ sourceId: string; substanceId: string; legacySourceId: string }>;
  studies: PersistStudy[];
  studySubstances: Array<{ studyId: string; substanceId: string }>;
  studySources: Array<{ studyId: string; sourceId: string }>;
  claims: Array<{ id: string }>;
  evidence: Array<{ claimId: string; reviewStatus: string }>;
  regulatory: Array<{ id: string; reviewStatus: string }>;
  productSubstances: Array<{ id: string }>;
}

export interface PersistResult {
  productionWrite: false;
  claimsCreated: 0;
  evidenceChanged: 0;
  regulatoryChanged: 0;
  sourcesInserted: number;
  sourcesLinked: number;
  sourcesSkippedDuplicate: number;
  sourcesExcludedHudson: number;
  sourcesRejectedIdentity: number;
  studiesInserted: number;
  studiesLinked: number;
  studiesSkippedDuplicate: number;
  studiesExcludedHudson: number;
  rolledBack: boolean;
}

function cloneStore(store: PersistStore): PersistStore {
  return structuredClone(store);
}

function substanceId(store: PersistStore, slug: string): string | null {
  return store.substances.find((row) => row.slug === slug)?.id ?? null;
}

function findSource(store: PersistStore, row: Pick<IntakeSourceRow, "pmid" | "doi" | "nctId">): PersistSource | undefined {
  if (row.pmid) {
    const hit = store.sources.find((item) => item.pmid === row.pmid);
    if (hit) return hit;
  }
  if (row.doi) {
    const hit = store.sources.find((item) => item.doi === row.doi);
    if (hit) return hit;
  }
  if (row.nctId) {
    const hit = store.sources.find((item) => item.nctId === row.nctId);
    if (hit) return hit;
  }
  return undefined;
}

function findStudy(store: PersistStore, nctId: string): PersistStudy | undefined {
  return store.studies.find((item) => item.nctId === nctId);
}

function linkSourceSubstance(store: PersistStore, sourceId: string, substanceIdValue: string, legacySourceId: string): boolean {
  const exists = store.sourceSubstances.some(
    (row) => row.sourceId === sourceId && row.substanceId === substanceIdValue,
  );
  if (exists) return false;
  store.sourceSubstances.push({ sourceId, substanceId: substanceIdValue, legacySourceId });
  return true;
}

function linkStudySubstance(store: PersistStore, studyId: string, substanceIdValue: string): boolean {
  const exists = store.studySubstances.some((row) => row.studyId === studyId && row.substanceId === substanceIdValue);
  if (exists) return false;
  store.studySubstances.push({ studyId, substanceId: substanceIdValue });
  return true;
}

function linkStudySource(store: PersistStore, studyId: string, sourceId: string): void {
  if (store.studySources.some((row) => row.studyId === studyId && row.sourceId === sourceId)) return;
  store.studySources.push({ studyId, sourceId });
}

function newId(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

function assertNoShopMutation(before: PersistStore, after: PersistStore): void {
  if (JSON.stringify(before.productSubstances) !== JSON.stringify(after.productSubstances)) {
    throw new Error("Product mapping must not change.");
  }
}

export function persistBatch03Intake(input: {
  plan: Batch03IntakePlan;
  store: PersistStore;
  fail?: boolean;
}): { store: PersistStore; result: PersistResult } {
  const snapshot = cloneStore(input.store);
  const empty: PersistResult = {
    productionWrite: false,
    claimsCreated: 0,
    evidenceChanged: 0,
    regulatoryChanged: 0,
    sourcesInserted: 0,
    sourcesLinked: 0,
    sourcesSkippedDuplicate: 0,
    sourcesExcludedHudson: 0,
    sourcesRejectedIdentity: 0,
    studiesInserted: 0,
    studiesLinked: 0,
    studiesSkippedDuplicate: 0,
    studiesExcludedHudson: 0,
    rolledBack: false,
  };

  try {
    if (input.fail) throw new Error("forced persist failure");
    const store = cloneStore(input.store);
    const claimsBefore = store.claims.length;
    const evidenceBefore = store.evidence.map((row) => row.reviewStatus).join(",");
    const regulatoryBefore = store.regulatory.map((row) => row.reviewStatus).join(",");

    for (const row of [...input.plan.sources.import, ...input.plan.sources.relationship]) {
      applySourceRow(store, row, empty);
    }
    for (const row of input.plan.studies.import) {
      applyStudyRow(store, row, empty);
    }

    if (store.claims.length !== claimsBefore) throw new Error("Claims must not be created.");
    if (store.evidence.map((row) => row.reviewStatus).join(",") !== evidenceBefore) {
      throw new Error("Evidence must not change.");
    }
    if (store.regulatory.map((row) => row.reviewStatus).join(",") !== regulatoryBefore) {
      throw new Error("Regulatory must not change.");
    }
    assertNoShopMutation(input.store, store);

    return { store, result: empty };
  } catch {
    return {
      store: snapshot,
      result: { ...empty, rolledBack: true, sourcesInserted: 0, sourcesLinked: 0, studiesInserted: 0, studiesLinked: 0 },
    };
  }
}

function applySourceRow(store: PersistStore, row: IntakeSourceRow, result: PersistResult): void {
  if (isExcludedNct(row.nctId) || isExcludedNct(row.identifier)) {
    result.sourcesExcludedHudson += 1;
    return;
  }
  if (identityIssueForCandidate(row.slug, row.title)) {
    result.sourcesRejectedIdentity += 1;
    return;
  }
  const sid = substanceId(store, row.slug);
  if (!sid) {
    result.sourcesRejectedIdentity += 1;
    return;
  }
  const existing = findSource(store, row);
  if (existing) {
    if (existing.reviewStatus === "approved" && row.disposition === "import") {
      result.sourcesSkippedDuplicate += 1;
    }
    const linked = linkSourceSubstance(store, existing.id, sid, row.candidateId);
    if (linked) result.sourcesLinked += 1;
    else result.sourcesSkippedDuplicate += 1;
    return;
  }
  if (row.disposition === "relationship") {
    result.sourcesSkippedDuplicate += 1;
    return;
  }
  const created: PersistSource = {
    id: newId("source", row.candidateId),
    sourceType: row.sourceType,
    title: row.title,
    publisher: row.publisher,
    publicationDate: row.publicationDate,
    accessDate: "2026-08-29",
    url: row.url,
    doi: row.doi,
    pmid: row.pmid,
    nctId: row.nctId,
    legacyIds: [row.candidateId],
    status: "active",
    reviewStatus: "review-required",
    connector: row.connector,
  };
  store.sources.push(created);
  result.sourcesInserted += 1;
  if (linkSourceSubstance(store, created.id, sid, row.candidateId)) result.sourcesLinked += 1;
}

function applyStudyRow(store: PersistStore, row: IntakeStudyRow, result: PersistResult): void {
  if (isExcludedNct(row.nctId) || /hudson biotech/i.test(row.sponsor ?? "")) {
    result.studiesExcludedHudson += 1;
    return;
  }
  if (identityIssueForCandidate(row.slug, row.title)) {
    return;
  }
  const sid = substanceId(store, row.slug);
  if (!sid) return;
  const existing = findStudy(store, row.nctId);
  if (existing) {
    result.studiesSkippedDuplicate += 1;
    if (linkStudySubstance(store, existing.id, sid)) result.studiesLinked += 1;
    const source = store.sources.find((item) => item.nctId === row.nctId);
    if (source) linkStudySource(store, existing.id, source.id);
    return;
  }
  const created: PersistStudy = {
    id: newId("study", row.candidateId),
    nctId: row.nctId,
    title: row.title,
    sponsor: row.sponsor,
    phase: row.phase,
    status: row.status,
    intervention: row.intervention,
    condition: row.condition,
    sourceUrl: row.url,
    reviewStatus: "review-required",
  };
  store.studies.push(created);
  result.studiesInserted += 1;
  if (linkStudySubstance(store, created.id, sid)) result.studiesLinked += 1;
  const source = store.sources.find((item) => item.nctId === row.nctId);
  if (source) linkStudySource(store, created.id, source.id);
}

export function publicVisibleSources(store: PersistStore): PersistSource[] {
  return store.sources.filter((row) => row.reviewStatus === "approved" && row.status === "active" && !isExcludedNct(row.nctId));
}

export function publicVisibleStudies(store: PersistStore): PersistStudy[] {
  return store.studies.filter((row) => row.reviewStatus === "approved" && !isExcludedNct(row.nctId));
}

export function adminVisibleSources(store: PersistStore): PersistSource[] {
  return store.sources.filter((row) => ["approved", "review-required", "rejected", "draft"].includes(row.reviewStatus));
}

export function adminVisibleStudies(store: PersistStore): PersistStudy[] {
  return store.studies.filter((row) => ["approved", "review-required", "rejected", "draft"].includes(row.reviewStatus));
}

export function canSelectSourceRow(
  role: "anon" | "authenticated" | "admin",
  row: Pick<PersistSource, "status" | "reviewStatus">,
): boolean {
  if (role === "anon") return false;
  if (role === "admin") return true;
  return row.status === "active" && row.reviewStatus === "approved";
}

export function canSelectStudyRow(
  role: "anon" | "authenticated" | "admin",
  row: Pick<PersistStudy, "status" | "reviewStatus">,
): boolean {
  if (role === "anon") return false;
  if (role === "admin") return true;
  return row.reviewStatus === "approved";
}

export function sqlLiteral(value: string | null): string {
  if (value == null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

export function renderBatch03IntakeSql(plan: Batch03IntakePlan): string {
  const lines: string[] = [
    "-- Batch 03 review intake import. NOT a numbered migration.",
    "-- Apply only after 0030, never against production in Phase 16.",
    "-- Idempotent. review_status is always review-required. No claims/evidence/regulatory writes.",
    "begin;",
  ];

  for (const row of plan.sources.import) {
    if (isExcludedNct(row.nctId)) continue;
    lines.push(
      [
        "insert into public.sources (",
        "  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,",
        "  legacy_ids, status, review_status, connector",
        ") values (",
        `  ${sqlLiteral(row.sourceType)}, ${sqlLiteral(row.title)}, ${sqlLiteral(row.publisher)},`,
        `  ${sqlLiteral(row.publicationDate)}, '2026-08-29', ${sqlLiteral(row.url)},`,
        `  ${sqlLiteral(row.doi)}, ${sqlLiteral(row.pmid)}, ${sqlLiteral(row.nctId)},`,
        `  array[${sqlLiteral(row.candidateId)}]::text[], 'active', 'review-required', ${sqlLiteral(row.connector)}`,
        ")",
        row.pmid
          ? "on conflict (pmid) where pmid is not null do nothing;"
          : "on conflict (nct_id) where nct_id is not null do nothing;",
      ].join("\n"),
    );
    lines.push(
      [
        "insert into public.source_substances (source_id, substance_id, legacy_source_id)",
        "select s.id, sub.id, " + sqlLiteral(row.candidateId),
        "from public.sources s",
        "join public.substances sub on sub.slug = " + sqlLiteral(row.slug),
        row.pmid ? `where s.pmid = ${sqlLiteral(row.pmid)}` : `where s.nct_id = ${sqlLiteral(row.nctId)}`,
        "on conflict (source_id, substance_id) do nothing;",
      ].join("\n"),
    );
  }

  for (const row of plan.sources.relationship) {
    lines.push(
      [
        "insert into public.source_substances (source_id, substance_id, legacy_source_id)",
        "select s.id, sub.id, " + sqlLiteral(row.candidateId),
        "from public.sources s",
        "join public.substances sub on sub.slug = " + sqlLiteral(row.slug),
        `where s.pmid = ${sqlLiteral(row.pmid)}`,
        "on conflict (source_id, substance_id) do nothing;",
      ].join("\n"),
    );
  }

  for (const row of plan.studies.import) {
    if (isExcludedNct(row.nctId)) continue;
    lines.push(
      [
        "insert into public.studies (",
        "  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results",
        ") values (",
        `  ${sqlLiteral(row.nctId)}, ${sqlLiteral(row.title)}, ${sqlLiteral(row.sponsor)},`,
        `  ${sqlLiteral(row.phase)}, ${sqlLiteral(row.status)}, ${sqlLiteral(row.intervention)},`,
        `  ${sqlLiteral(row.condition)}, ${sqlLiteral(row.url)}, 'review-required', false`,
        ")",
        "on conflict (nct_id) do nothing;",
      ].join("\n"),
    );
    lines.push(
      [
        "insert into public.study_substances (study_id, substance_id)",
        "select st.id, sub.id",
        "from public.studies st",
        "join public.substances sub on sub.slug = " + sqlLiteral(row.slug),
        `where st.nct_id = ${sqlLiteral(row.nctId)}`,
        "on conflict (study_id, substance_id) do nothing;",
      ].join("\n"),
    );
    lines.push(
      [
        "insert into public.study_sources (study_id, source_id)",
        "select st.id, s.id",
        "from public.studies st",
        "join public.sources s on s.nct_id = st.nct_id",
        `where st.nct_id = ${sqlLiteral(row.nctId)}`,
        "on conflict (study_id, source_id) do nothing;",
      ].join("\n"),
    );
  }

  lines.push("commit;");
  return `${lines.join("\n\n")}\n`;
}

export function analyzeMigration0030(sql: string) {
  return {
    addsSourceReviewStatus: /sources[\s\S]*review_status/.test(sql),
    addsStudyReviewStatus: /studies[\s\S]*review_status/.test(sql),
    defaultReviewRequired: /set default 'review-required'/.test(sql),
    backfillsApproved: /set review_status = 'approved'/.test(sql),
    noDropTable: !/\bdrop table\b/i.test(sql),
    noTruncate: !/^\s*truncate\b/im.test(sql),
    noDeleteFrom: !/\bdelete from\b/i.test(sql),
    noShopTables: !/\bpublic\.(products|carts|orders|user_roles)\b/.test(sql),
    extendsReviewActions: /'source'/.test(sql) && /'study'/.test(sql),
    anonRevoke: /revoke all on table public\.sources from anon/.test(sql),
    sourcePolicyUsesReviewStatus: /status = 'active' and review_status = 'approved'/.test(sql),
    studyPolicyIgnoresClinicalStatus: /or review_status = 'approved'/.test(sql),
    noAutoImport: !/insert into public\.sources/i.test(sql),
  };
}
