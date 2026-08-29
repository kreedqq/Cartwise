import { supabase } from "@/lib/supabaseClient";
import {
  ADMIN_RESEARCH_PAGE_SIZE,
  RESEARCH_UPDATES_TABLE_EXISTS,
  assertAdminCanWriteReview,
  buildReviewActionDraft,
  emptyDashboard,
  openSubstanceReviews,
  type AdminResearchDashboard,
  type AdminReviewAction,
  type ResearchEntityType,
  type ReviewQueueItem,
  type ReviewQueueKind,
} from "@/lib/peptide/adminResearch";
import { communityCannotAppearAsScientificEvidence } from "@/lib/peptide/adminResearch/workflow";
import {
  BATCH_03_MIGRATION_REQUIRED,
  BATCH03_PRODUCTION_IMPORT_PENDING,
  intakeQueueItems,
  intakeSourceById,
  intakeStudyById,
  isIntakePlaceholderId,
} from "@/lib/peptide/research/batch03Intake";
import { batch03LocalIntakePlan } from "@/lib/peptide/research/batch03IntakeLoader";
import { isPersistedUuid } from "@/lib/peptide/research/operations/ids";

export interface ReviewPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewItemDetail {
  kind: ReviewQueueKind;
  id: string;
  stableKey: string;
  substanceSlug: string;
  substanceName: string;
  statement: string | null;
  claimType: string | null;
  status: string;
  evidenceLevel: string | null;
  evidenceType: string | null;
  confidence: string | null;
  rationale: string | null;
  authority: string | null;
  region: string | null;
  regulatoryStatus: string | null;
  productName: string | null;
  applicationId: string | null;
  isCurrent: boolean | null;
  url?: string | null;
  sourceType?: string | null;
  identifier?: string | null;
  publicationDate?: string | null;
  connector?: string | null;
  publisher?: string | null;
  pmid?: string | null;
  doi?: string | null;
  nctId?: string | null;
  intervention?: string | null;
  condition?: string | null;
  phase?: string | null;
  studyStatus?: string | null;
  sponsor?: string | null;
  persisted?: boolean;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    sourceType: string;
    pmid: string | null;
    doi: string | null;
    nctId: string | null;
  }>;
  studies: Array<{ nctId: string; title: string; sponsor: string | null; phase: string | null; status: string | null }>;
}

export interface ProductMappingRow {
  id: string;
  code: string;
  name: string;
  substanceSlug: string;
  substanceName: string;
  mappingMethod: string;
}

async function countExact(
  table: "claims" | "sources" | "studies" | "substances" | "evidence_assessments" | "regulatory_records" | "review_actions",
  column: string,
  value?: string,
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (value) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAdminResearchDashboard(): Promise<AdminResearchDashboard> {
  const dash = emptyDashboard("postgres");
  const [
    substances,
    sources,
    studies,
    claims,
    claimsApproved,
    claimsRejected,
    claimsReviewRequired,
    evidenceReviewRequired,
    evidenceApproved,
    evidenceRejected,
    regulatoryReviewRequired,
    regulatoryApproved,
    reviewActions,
  ] = await Promise.all([
    countExact("substances", "id"),
    countExact("sources", "id"),
    countExact("studies", "id"),
    countExact("claims", "id"),
    countExact("claims", "status", "approved"),
    countExact("claims", "status", "rejected"),
    countExact("claims", "status", "review-required"),
    countExact("evidence_assessments", "review_status", "review-required"),
    countExact("evidence_assessments", "review_status", "approved"),
    countExact("evidence_assessments", "review_status", "rejected"),
    countExact("regulatory_records", "review_status", "review-required"),
    countExact("regulatory_records", "review_status", "approved"),
    countExact("review_actions", "id"),
  ]);
  dash.substances = substances;
  dash.sources = sources;
  dash.studies = studies;
  dash.claims = claims;
  dash.claimsApproved = claimsApproved;
  dash.claimsRejected = claimsRejected;
  dash.claimsReviewRequired = claimsReviewRequired;
  dash.evidenceReviewRequired = evidenceReviewRequired;
  dash.evidenceApproved = evidenceApproved;
  dash.evidenceRejected = evidenceRejected;
  dash.regulatoryReviewRequired = regulatoryReviewRequired;
  dash.regulatoryApproved = regulatoryApproved;
  dash.reviewActions = reviewActions;
  dash.researchUpdates = RESEARCH_UPDATES_TABLE_EXISTS ? 0 : 0;
  dash.communityReports = 0;

  try {
    dash.sourcesReviewRequired = await countExact("sources", "review_status", "review-required");
    dash.studiesReviewRequired = await countExact("studies", "review_status", "review-required");
    dash.intakeMode = "postgres";
    dash.migrationRequired = null;
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const plan = await batch03LocalIntakePlan();
    dash.sourcesReviewRequired = plan.sources.import.length;
    dash.studiesReviewRequired = plan.studies.import.length;
    dash.intakeMode = "local-candidates";
    dash.migrationRequired = BATCH_03_MIGRATION_REQUIRED;
  }
  if (BATCH03_PRODUCTION_IMPORT_PENDING && dash.intakeMode === "postgres" && dash.sourcesReviewRequired === 0 && dash.studiesReviewRequired === 0) {
    const plan = await batch03LocalIntakePlan();
    dash.sourcesReviewRequired = plan.sources.import.length;
    dash.studiesReviewRequired = plan.studies.import.length;
    dash.intakeMode = "local-candidates";
    dash.migrationRequired = dash.migrationRequired ?? BATCH_03_MIGRATION_REQUIRED;
  }
  return dash;
}

function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = Math.max(0, page) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function isMissingColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /review_status|column .* does not exist|schema cache/i.test(message)
  );
}

async function localIntakeQueue(
  kind: "source" | "study",
  page: number,
  pageSize: number,
): Promise<ReviewPage<ReviewQueueItem>> {
  const plan = await batch03LocalIntakePlan();
  const all = intakeQueueItems(plan).filter((item) => item.kind === kind);
  const { from, to } = pageRange(page, pageSize);
  return { items: all.slice(from, to + 1), total: all.length, page, pageSize };
}

export async function fetchReviewQueue(
  kind: ReviewQueueKind,
  page = 0,
  pageSize = ADMIN_RESEARCH_PAGE_SIZE,
): Promise<ReviewPage<ReviewQueueItem>> {
  const { from, to } = pageRange(page, pageSize);

  if (kind === "evidence") {
    const { data, error, count } = await supabase
      .from("evidence_assessments")
      .select(
        "id, review_status, evidence_type, rationale, claim_id, claims(stable_key, statement, status, substances(slug, name))",
        { count: "exact" },
      )
      .eq("review_status", "review-required")
      .order("updated_at", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const items: ReviewQueueItem[] = (data ?? []).map((row) => {
      const claim = unwrap(row.claims);
      const substance = unwrap(claim?.substances);
      return {
        kind: "evidence",
        id: row.id,
        stableKey: claim?.stable_key ?? row.id,
        substanceSlug: substance?.slug ?? "",
        title: claim?.statement ?? "Evidence assessment",
        status: row.review_status,
        note: row.rationale,
        sourceCount: 0,
      };
    });
    return { items, total: count ?? items.length, page, pageSize };
  }

  if (kind === "claim") {
    const { data, error, count } = await supabase
      .from("claims")
      .select("id, stable_key, statement, status, claim_type, substances(slug, name)", { count: "exact" })
      .in("status", ["review-required", "draft"])
      .order("updated_at", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const items: ReviewQueueItem[] = (data ?? []).map((row) => {
      const substance = unwrap(row.substances);
      return {
        kind: "claim",
        id: row.id,
        stableKey: row.stable_key,
        substanceSlug: substance?.slug ?? "",
        title: row.statement,
        status: row.status,
        note: row.claim_type,
        sourceCount: 0,
      };
    });
    return { items, total: count ?? items.length, page, pageSize };
  }

  if (kind === "regulatory") {
    const { data, error, count } = await supabase
      .from("regulatory_records")
      .select(
        "id, stable_key, review_status, authority, region, status, product_name, application_id, note, substances(slug, name)",
        { count: "exact" },
      )
      .eq("review_status", "review-required")
      .order("updated_at", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const items: ReviewQueueItem[] = (data ?? []).map((row) => {
      const substance = unwrap(row.substances);
      return {
        kind: "regulatory",
        id: row.id,
        stableKey: row.stable_key,
        substanceSlug: substance?.slug ?? "",
        title: `${row.authority} ${row.region} ${row.product_name ?? row.application_id ?? ""}`.trim(),
        status: row.review_status,
        note: row.note,
        sourceCount: 1,
      };
    });
    return { items, total: count ?? items.length, page, pageSize };
  }

  if (kind === "source" || kind === "study") {
    try {
      if (kind === "source") {
        const { data, error, count } = await supabase
          .from("sources")
          .select(
            "id, title, url, source_type, pmid, doi, nct_id, publication_date, connector, review_status, source_substances(substances(slug, name))",
            { count: "exact" },
          )
          .eq("review_status", "review-required")
          .order("title", { ascending: true })
          .range(from, to);
        if (error) throw error;
        if ((count ?? 0) > 0 || !BATCH03_PRODUCTION_IMPORT_PENDING) {
          const items: ReviewQueueItem[] = (data ?? []).map((row) => {
            const link = unwrap(row.source_substances);
            const substance = unwrap(link?.substances);
            return {
              kind: "source",
              id: row.id,
              stableKey: row.pmid ? `pmid:${row.pmid}` : row.nct_id ? `nct:${row.nct_id}` : row.id,
              substanceSlug: substance?.slug ?? "",
              title: row.title,
              status: row.review_status,
              note: [row.source_type, row.pmid ? `PMID ${row.pmid}` : null, row.nct_id, row.connector]
                .filter(Boolean)
                .join(" · "),
              sourceCount: 1,
            };
          });
          return { items, total: count ?? items.length, page, pageSize };
        }
      } else {
        const { data, error, count } = await supabase
          .from("studies")
          .select(
            "id, nct_id, title, sponsor, phase, status, intervention, condition, review_status, study_substances(substances(slug, name))",
            { count: "exact" },
          )
          .eq("review_status", "review-required")
          .order("title", { ascending: true })
          .range(from, to);
        if (error) throw error;
        if ((count ?? 0) > 0 || !BATCH03_PRODUCTION_IMPORT_PENDING) {
          const items: ReviewQueueItem[] = (data ?? []).map((row) => {
            const link = unwrap(row.study_substances);
            const substance = unwrap(link?.substances);
            return {
              kind: "study",
              id: row.id,
              stableKey: row.nct_id,
              substanceSlug: substance?.slug ?? "",
              title: row.title,
              status: row.review_status,
              note: [row.nct_id, row.phase, row.status, row.sponsor].filter(Boolean).join(" · "),
              sourceCount: 1,
            };
          });
          return { items, total: count ?? items.length, page, pageSize };
        }
      }
    } catch (error) {
      if (!isMissingColumnError(error) && !BATCH03_PRODUCTION_IMPORT_PENDING) throw error;
    }
    return localIntakeQueue(kind, page, pageSize);
  }

  const { data, error } = await supabase
    .from("review_actions")
    .select("id, entity_type, entity_stable_key, action, created_at, reason")
    .eq("entity_type", "substance")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  const open = openSubstanceReviews(data ?? []);
  const slice = open.slice(from, to + 1);
  return { items: slice, total: open.length, page, pageSize };
}

export async function fetchReviewItemDetail(kind: ReviewQueueKind, id: string): Promise<ReviewItemDetail> {
  if (kind === "evidence") {
    const { data, error } = await supabase
      .from("evidence_assessments")
      .select(
        "id, review_status, evidence_level, evidence_type, confidence, rationale, claim_id, claims(id, stable_key, statement, claim_type, status, substances(slug, name))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Evidence assessment nicht gefunden.");
    const claim = unwrap(data.claims);
    const substance = unwrap(claim?.substances);
    const linked = claim?.id ? await fetchClaimSources(claim.id) : { sources: [], studies: [] };
    return {
      kind,
      id: data.id,
      stableKey: claim?.stable_key ?? data.id,
      substanceSlug: substance?.slug ?? "",
      substanceName: substance?.name ?? "",
      statement: claim?.statement ?? null,
      claimType: claim?.claim_type ?? null,
      status: data.review_status,
      evidenceLevel: data.evidence_level,
      evidenceType: data.evidence_type,
      confidence: data.confidence,
      rationale: data.rationale,
      authority: null,
      region: null,
      regulatoryStatus: null,
      productName: null,
      applicationId: null,
      isCurrent: null,
      sources: linked.sources,
      studies: linked.studies,
    };
  }

  if (kind === "claim") {
    const { data, error } = await supabase
      .from("claims")
      .select("id, stable_key, statement, claim_type, status, substances(slug, name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Claim nicht gefunden.");
    const substance = unwrap(data.substances);
    const linked = await fetchClaimSources(data.id);
    const { data: evidence } = await supabase
      .from("evidence_assessments")
      .select("evidence_level, evidence_type, confidence, rationale, review_status")
      .eq("claim_id", data.id)
      .maybeSingle();
    return {
      kind,
      id: data.id,
      stableKey: data.stable_key,
      substanceSlug: substance?.slug ?? "",
      substanceName: substance?.name ?? "",
      statement: data.statement,
      claimType: data.claim_type,
      status: data.status,
      evidenceLevel: evidence?.evidence_level ?? null,
      evidenceType: evidence?.evidence_type ?? null,
      confidence: evidence?.confidence ?? null,
      rationale: evidence?.rationale ?? null,
      authority: null,
      region: null,
      regulatoryStatus: null,
      productName: null,
      applicationId: null,
      isCurrent: null,
      sources: linked.sources,
      studies: linked.studies,
    };
  }

  if (kind === "regulatory") {
    const { data, error } = await supabase
      .from("regulatory_records")
      .select(
        "id, stable_key, review_status, authority, region, status, indication, product_name, application_id, is_current, note, source_id, substances(slug, name), sources(id, title, url, source_type, pmid, doi, nct_id)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Regulatory record nicht gefunden.");
    const substance = unwrap(data.substances);
    const source = unwrap(data.sources);
    return {
      kind,
      id: data.id,
      stableKey: data.stable_key,
      substanceSlug: substance?.slug ?? "",
      substanceName: substance?.name ?? "",
      statement: data.note,
      claimType: null,
      status: data.review_status,
      evidenceLevel: null,
      evidenceType: null,
      confidence: null,
      rationale: data.indication,
      authority: data.authority,
      region: data.region,
      regulatoryStatus: data.status,
      productName: data.product_name,
      applicationId: data.application_id,
      isCurrent: data.is_current,
      sources: source
        ? [
            {
              id: source.id,
              title: source.title,
              url: source.url,
              sourceType: source.source_type,
              pmid: source.pmid,
              doi: source.doi,
              nctId: source.nct_id,
            },
          ]
        : [],
      studies: [],
    };
  }

  if (kind === "source") {
    if (isIntakePlaceholderId(id)) {
      const plan = await batch03LocalIntakePlan();
      const row = intakeSourceById(plan, id);
      if (!row) throw new Error("Intake-Source nicht gefunden.");
      return {
        kind,
        id,
        stableKey: row.candidateId,
        substanceSlug: row.slug,
        substanceName: row.slug,
        statement: row.title,
        claimType: row.sourceType,
        status: row.reviewStatus,
        evidenceLevel: null,
        evidenceType: null,
        confidence: null,
        rationale: row.reason,
        authority: null,
        region: null,
        regulatoryStatus: null,
        productName: null,
        applicationId: null,
        isCurrent: null,
        url: row.url,
        sourceType: row.sourceType,
        identifier: row.identifier,
        publicationDate: row.publicationDate,
        connector: row.connector,
        publisher: row.publisher,
        pmid: row.pmid,
        doi: row.doi,
        nctId: row.nctId,
        persisted: false,
        sources: [
          {
            id: row.candidateId,
            title: row.title,
            url: row.url,
            sourceType: row.sourceType,
            pmid: row.pmid,
            doi: row.doi,
            nctId: row.nctId,
          },
        ],
        studies: row.nctId ? [{ nctId: row.nctId, title: row.title, sponsor: null, phase: null, status: null }] : [],
      };
    }
    const { data, error } = await supabase
      .from("sources")
      .select(
        "id, title, url, source_type, pmid, doi, nct_id, publication_date, publisher, connector, review_status, source_substances(substances(slug, name))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Source nicht gefunden.");
    const link = unwrap(data.source_substances);
    const substance = unwrap(link?.substances);
    return {
      kind,
      id: data.id,
      stableKey: data.pmid ? `pmid:${data.pmid}` : data.nct_id ? `nct:${data.nct_id}` : data.id,
      substanceSlug: substance?.slug ?? "",
      substanceName: substance?.name ?? "",
      statement: data.title,
      claimType: data.source_type,
      status: data.review_status,
      evidenceLevel: null,
      evidenceType: null,
      confidence: null,
      rationale: null,
      authority: null,
      region: null,
      regulatoryStatus: null,
      productName: null,
      applicationId: null,
      isCurrent: null,
      url: data.url,
      sourceType: data.source_type,
      identifier: data.pmid ? `PMID ${data.pmid}` : data.nct_id,
      publicationDate: data.publication_date,
      connector: data.connector,
      publisher: data.publisher,
      pmid: data.pmid,
      doi: data.doi,
      nctId: data.nct_id,
      persisted: true,
      sources: [
        {
          id: data.id,
          title: data.title,
          url: data.url,
          sourceType: data.source_type,
          pmid: data.pmid,
          doi: data.doi,
          nctId: data.nct_id,
        },
      ],
      studies: data.nct_id ? [{ nctId: data.nct_id, title: data.title, sponsor: null, phase: null, status: null }] : [],
    };
  }

  if (kind === "study") {
    if (isIntakePlaceholderId(id)) {
      const plan = await batch03LocalIntakePlan();
      const row = intakeStudyById(plan, id);
      if (!row) throw new Error("Intake-Study nicht gefunden.");
      return {
        kind,
        id,
        stableKey: row.nctId,
        substanceSlug: row.slug,
        substanceName: row.slug,
        statement: row.title,
        claimType: null,
        status: row.reviewStatus,
        evidenceLevel: null,
        evidenceType: null,
        confidence: null,
        rationale: null,
        authority: null,
        region: null,
        regulatoryStatus: null,
        productName: null,
        applicationId: null,
        isCurrent: null,
        url: row.url,
        identifier: row.nctId,
        nctId: row.nctId,
        intervention: row.intervention,
        condition: row.condition,
        phase: row.phase,
        studyStatus: row.status,
        sponsor: row.sponsor,
        persisted: false,
        sources: [
          {
            id: row.candidateId,
            title: row.title,
            url: row.url,
            sourceType: "clinical_trial",
            pmid: null,
            doi: null,
            nctId: row.nctId,
          },
        ],
        studies: [
          {
            nctId: row.nctId,
            title: row.title,
            sponsor: row.sponsor,
            phase: row.phase,
            status: row.status,
          },
        ],
      };
    }
    const { data, error } = await supabase
      .from("studies")
      .select(
        "id, nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, study_substances(substances(slug, name)), study_sources(sources(id, title, url, source_type, pmid, doi, nct_id))",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Study nicht gefunden.");
    const link = unwrap(data.study_substances);
    const substance = unwrap(link?.substances);
    const linkedSources = Array.isArray(data.study_sources) ? data.study_sources : data.study_sources ? [data.study_sources] : [];
    return {
      kind,
      id: data.id,
      stableKey: data.nct_id,
      substanceSlug: substance?.slug ?? "",
      substanceName: substance?.name ?? "",
      statement: data.title,
      claimType: null,
      status: data.review_status,
      evidenceLevel: null,
      evidenceType: null,
      confidence: null,
      rationale: null,
      authority: null,
      region: null,
      regulatoryStatus: null,
      productName: null,
      applicationId: null,
      isCurrent: null,
      url: data.source_url,
      identifier: data.nct_id,
      nctId: data.nct_id,
      intervention: data.intervention,
      condition: data.condition,
      phase: data.phase,
      studyStatus: data.status,
      sponsor: data.sponsor,
      persisted: true,
      sources: linkedSources.flatMap((item) => {
        const source = unwrap((item as { sources?: unknown }).sources);
        if (!source || typeof source !== "object") return [];
        const row = source as {
          id: string;
          title: string;
          url: string;
          source_type: string;
          pmid: string | null;
          doi: string | null;
          nct_id: string | null;
        };
        return [
          {
            id: row.id,
            title: row.title,
            url: row.url,
            sourceType: row.source_type,
            pmid: row.pmid,
            doi: row.doi,
            nctId: row.nct_id,
          },
        ];
      }),
      studies: [
        {
          nctId: data.nct_id,
          title: data.title,
          sponsor: data.sponsor,
          phase: data.phase,
          status: data.status,
        },
      ],
    };
  }

  const { data, error } = await supabase
    .from("review_actions")
    .select("id, entity_stable_key, reason, action")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Review action nicht gefunden.");
  return {
    kind: "substance",
    id: data.id,
    stableKey: data.entity_stable_key ?? data.id,
    substanceSlug: data.entity_stable_key ?? "",
    substanceName: data.entity_stable_key ?? "",
    statement: data.reason,
    claimType: null,
    status: "review-required",
    evidenceLevel: null,
    evidenceType: null,
    confidence: null,
    rationale: data.reason,
    authority: null,
    region: null,
    regulatoryStatus: null,
    productName: null,
    applicationId: null,
    isCurrent: null,
    sources: [],
    studies: [],
  };
}

async function fetchClaimSources(claimId: string): Promise<Pick<ReviewItemDetail, "sources" | "studies">> {
  const { data, error } = await supabase
    .from("claim_sources")
    .select("source_id, study_id, sources(id, title, url, source_type, pmid, doi, nct_id), studies(nct_id, title, sponsor, phase, status)")
    .eq("claim_id", claimId);
  if (error) throw error;
  const sources: ReviewItemDetail["sources"] = [];
  const studies: ReviewItemDetail["studies"] = [];
  for (const row of data ?? []) {
    const source = unwrap(row.sources);
    if (source) {
      if (communityCannotAppearAsScientificEvidence(source.source_type)) continue;
      sources.push({
        id: source.id,
        title: source.title,
        url: source.url,
        sourceType: source.source_type,
        pmid: source.pmid,
        doi: source.doi,
        nctId: source.nct_id,
      });
    }
    const study = unwrap(row.studies);
    if (study) {
      studies.push({
        nctId: study.nct_id,
        title: study.title,
        sponsor: study.sponsor,
        phase: study.phase,
        status: study.status,
      });
    }
  }
  return { sources, studies };
}

export async function fetchProductMappings(
  page = 0,
  pageSize = ADMIN_RESEARCH_PAGE_SIZE,
): Promise<ReviewPage<ProductMappingRow>> {
  const { from, to } = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from("product_substances")
    .select("id, mapping_method, substances(slug, name), products(code, name)", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) throw error;
  const items: ProductMappingRow[] = (data ?? []).flatMap((row) => {
    const substance = unwrap(row.substances);
    const product = unwrap(row.products);
    if (!product?.code || !substance?.slug) return [];
    return [
      {
        id: row.id,
        code: product.code,
        name: product.name,
        substanceSlug: substance.slug,
        substanceName: substance.name,
        mappingMethod: row.mapping_method,
      },
    ];
  });
  return { items, total: count ?? items.length, page, pageSize };
}

export async function submitAdminReview(input: {
  isAdmin: boolean;
  adminUserId: string | null;
  kind: ReviewQueueKind;
  id: string;
  stableKey: string;
  action: AdminReviewAction;
  previousStatus: string | null;
  reason: string;
}): Promise<void> {
  assertAdminCanWriteReview(input.isAdmin);
  if (isIntakePlaceholderId(input.id)) {
    throw new Error(
      `MIGRATION_REQUIRED: ${BATCH_03_MIGRATION_REQUIRED}. Kandidat ist nicht persistiert. Approve/Reject erst nach Import.`,
    );
  }
  if ((input.kind === "source" || input.kind === "study") && !isPersistedUuid(input.id)) {
    throw new Error("Approve/Reject nur für persistierte UUID-Datensätze.");
  }
  const entityType: ResearchEntityType =
    input.kind === "evidence"
      ? "evidence_assessment"
      : input.kind === "claim"
        ? "claim"
        : input.kind === "regulatory"
          ? "regulatory_record"
          : input.kind === "source"
            ? "source"
            : input.kind === "study"
              ? "study"
              : "substance";
  const draft = buildReviewActionDraft({
    entityType,
    entityId: input.kind === "substance" ? null : input.id,
    entityStableKey: input.stableKey,
    action: input.action,
    previousStatus: input.previousStatus,
    reason: input.reason,
    adminUserId: input.adminUserId,
  });

  const { error: insertError } = await supabase.from("review_actions").insert({
    entity_type: draft.entityType,
    entity_id: draft.entityId,
    entity_stable_key: draft.entityStableKey,
    action: draft.action,
    previous_status: draft.previousStatus,
    new_status: draft.newStatus,
    reason: draft.reason,
    admin_user_id: draft.adminUserId,
  });
  if (insertError) throw insertError;

  if (input.kind === "claim") {
    const { error } = await supabase.from("claims").update({ status: draft.newStatus }).eq("id", input.id);
    if (error) throw error;
    return;
  }
  if (input.kind === "evidence") {
    const { error } = await supabase
      .from("evidence_assessments")
      .update({ review_status: draft.newStatus })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  if (input.kind === "regulatory") {
    const { error } = await supabase
      .from("regulatory_records")
      .update({ review_status: draft.newStatus })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  if (input.kind === "source") {
    const { error } = await supabase.from("sources").update({ review_status: draft.newStatus }).eq("id", input.id);
    if (error) throw error;
    return;
  }
  if (input.kind === "study") {
    const { error } = await supabase.from("studies").update({ review_status: draft.newStatus }).eq("id", input.id);
    if (error) throw error;
  }
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
