import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { identitySeedFromCatalog } from "@/lib/peptide/persistence/identitySeed";
import { publishedClaimsSeed } from "@/lib/peptide/persistence/publishedClaimsSeed";
import { publishedRegulatorySeed } from "@/lib/peptide/persistence/publishedRegulatorySeed";
import { publishedScienceSeed } from "@/lib/peptide/persistence/publishedScienceSeed";
import { EXCLUDED_STUDY_NCTS, isExcludedNct } from "@/lib/peptide/persistence/identifiers";
import { listPublishedProfiles } from "@/lib/peptide/profiles";
import { PRODUCT_CODE_PREFIX_RULES } from "@/lib/peptide/search";
import { COMMUNITY_SOURCE_TYPES } from "@/lib/peptide/types";

export type ParityStatus = "MATCH" | "MISSING_POSTGRES" | "MISSING_LEGACY" | "DIFFERENT" | "UNRESOLVED";

export type MigrationReadiness = "READY" | "READY_WITH_REVIEW" | "NOT_READY";

export interface ParityCounts {
  MATCH: number;
  MISSING_POSTGRES: number;
  MISSING_LEGACY: number;
  DIFFERENT: number;
  UNRESOLVED: number;
}

function emptyCounts(): ParityCounts {
  return { MATCH: 0, MISSING_POSTGRES: 0, MISSING_LEGACY: 0, DIFFERENT: 0, UNRESOLVED: 0 };
}

function bump(counts: ParityCounts, status: ParityStatus): void {
  counts[status] += 1;
}

export function buildResearchReadinessReport() {
  const identity = identitySeedFromCatalog();
  const science = publishedScienceSeed();
  const claims = publishedClaimsSeed();
  const regulatory = publishedRegulatorySeed();
  const profiles = listPublishedProfiles();

  const identityParity = emptyCounts();
  for (const catalogRow of PEPTIDE_SUBSTANCES_IDENTITY) {
    const pg = identity.find((row) => row.slug === catalogRow.slug);
    if (!pg) {
      bump(identityParity, "MISSING_POSTGRES");
      continue;
    }
    const nameOk = pg.name === catalogRow.name && pg.displayName === catalogRow.displayName;
    const moleculeOk = pg.moleculeType === catalogRow.moleculeType;
    const casOk = pg.casNumber === catalogRow.casNumber;
    const classOk = pg.chemicalClass === catalogRow.chemicalClass;
    const statusOk =
      catalogRow.moleculeType === "blend" || catalogRow.blendComponentSlugs.length > 0
        ? pg.status === "blend"
        : pg.status === "active";
    if (nameOk && moleculeOk && casOk && classOk && statusOk) bump(identityParity, "MATCH");
    else bump(identityParity, "DIFFERENT");
  }
  for (const row of identity) {
    if (!PEPTIDE_SUBSTANCES_IDENTITY.some((item) => item.slug === row.slug)) {
      bump(identityParity, "MISSING_LEGACY");
    }
  }

  const catalogAliasKeys = PEPTIDE_SUBSTANCES_IDENTITY.flatMap((item) => [
    ...item.aliases.map((alias) => `${item.slug}::${alias}::common_name`),
    ...item.developmentNames.map((alias) => `${item.slug}::${alias}::development_name`),
  ]);
  const pgAliasKeys = identity.flatMap((row) =>
    row.aliases.map((entry) => `${row.slug}::${entry.alias}::${entry.aliasType}`),
  );
  const aliasParity = emptyCounts();
  for (const key of catalogAliasKeys) {
    bump(aliasParity, pgAliasKeys.includes(key) ? "MATCH" : "MISSING_POSTGRES");
  }
  for (const key of pgAliasKeys) {
    if (!catalogAliasKeys.includes(key)) bump(aliasParity, "MISSING_LEGACY");
  }

  const sourceParity = emptyCounts();
  for (const row of science.reconciliation.filter((item) => item.kind === "source")) {
    if (row.status === "MATCH") bump(sourceParity, "MATCH");
    else if (row.status === "DIFFERENT") bump(sourceParity, "DIFFERENT");
    else if (row.status === "UNRESOLVED") bump(sourceParity, "UNRESOLVED");
    else if (row.status === "MISSING_IN_POSTGRES") bump(sourceParity, "MISSING_POSTGRES");
    else bump(sourceParity, "MISSING_LEGACY");
  }

  const studyParity = emptyCounts();
  for (const row of science.reconciliation.filter((item) => item.kind === "study")) {
    if (row.status === "MATCH") bump(studyParity, "MATCH");
    else if (row.status === "DIFFERENT") bump(studyParity, "DIFFERENT");
    else if (row.status === "UNRESOLVED") bump(studyParity, "UNRESOLVED");
    else if (row.status === "MISSING_IN_POSTGRES") bump(studyParity, "MISSING_POSTGRES");
    else bump(studyParity, "MISSING_LEGACY");
  }

  const claimParity = emptyCounts();
  for (const row of claims.reconciliation) {
    if (row.status === "MATCH") bump(claimParity, "MATCH");
    else if (row.status === "DIFFERENT") bump(claimParity, "DIFFERENT");
    else if (row.status === "UNRESOLVED") bump(claimParity, "UNRESOLVED");
    else if (row.status === "MISSING_IN_POSTGRES") bump(claimParity, "MISSING_POSTGRES");
    else bump(claimParity, "MISSING_LEGACY");
  }

  const evidenceWithLevel = claims.evidenceAssessments.filter((row) => row.evidenceLevel);
  const evidenceReviewRequired = claims.evidenceAssessments.filter((row) => row.reviewStatus === "review-required");

  const regulatorySourceParity = emptyCounts();
  for (const row of regulatory.reconciliation.filter((item) => !item.jsonRef.includes("overlay"))) {
    if (row.status === "MATCH") bump(regulatorySourceParity, "MATCH");
    else if (row.status === "UNRESOLVED") bump(regulatorySourceParity, "UNRESOLVED");
    else if (row.status === "DIFFERENT") bump(regulatorySourceParity, "DIFFERENT");
    else if (row.status === "MISSING_IN_POSTGRES") bump(regulatorySourceParity, "MISSING_POSTGRES");
    else bump(regulatorySourceParity, "MISSING_LEGACY");
  }

  const jsonReviewItems = profiles.flatMap((profile) => profile.reviewItems ?? []);
  const reviewParity = emptyCounts();
  if (jsonReviewItems.length === regulatory.reviewActions.length) {
    reviewParity.MATCH = jsonReviewItems.length;
  } else if (jsonReviewItems.length > regulatory.reviewActions.length) {
    reviewParity.MATCH = regulatory.reviewActions.length;
    reviewParity.MISSING_POSTGRES = jsonReviewItems.length - regulatory.reviewActions.length;
  } else {
    reviewParity.MATCH = jsonReviewItems.length;
    reviewParity.MISSING_LEGACY = regulatory.reviewActions.length - jsonReviewItems.length;
  }

  const publishedHudsonStudies = profiles.flatMap((profile) =>
    profile.studies.filter((study) => isExcludedNct(study.clinicalTrialId)),
  );
  const publishedHudsonSources = profiles.flatMap((profile) =>
    profile.sources.filter((source) => isExcludedNct(source.clinicalTrialId)),
  );
  const seedHudsonStudies = science.studies.filter((row) => isExcludedNct(row.nctId));
  const seedHudsonSources = science.sources.filter((row) => isExcludedNct(row.nctId));
  const communitySources = profiles.flatMap((profile) =>
    profile.sources.filter((source) => COMMUNITY_SOURCE_TYPES.includes(source.sourceType)),
  );

  const sourceWithoutSubstance = science.sources.filter(
    (row) => !science.sourceSubstances.some((link) => link.sourceKey === row.key),
  );
  const studyWithoutSubstance = science.studies.filter(
    (row) => !science.studySubstances.some((link) => link.nctId === row.nctId),
  );
  const studyWithoutSource = science.studies.filter(
    (row) => !science.studySources.some((link) => link.nctId === row.nctId),
  );
  const regulatoryWithoutSource = regulatory.records.filter((row) => !row.legacySourceId);

  const contentBlocking =
    claims.claimsWithoutSources > 0 ||
    publishedHudsonStudies.length > 0 ||
    publishedHudsonSources.length > 0 ||
    seedHudsonStudies.length > 0 ||
    seedHudsonSources.length > 0 ||
    communitySources.length > 0 ||
    sourceParity.MISSING_POSTGRES > 0 ||
    claimParity.MISSING_POSTGRES > 0;

  const contentReadiness: MigrationReadiness = contentBlocking
    ? "NOT_READY"
    : regulatorySourceParity.UNRESOLVED > 0
      ? "READY_WITH_REVIEW"
      : "READY";

  return {
    inventory: {
      substances: identity.length,
      aliases: pgAliasKeys.length,
      components: identity.reduce((sum, row) => sum + row.componentSlugs.length, 0),
      researchRuns: science.researchRuns.length,
      jsonSources: science.jsonSourceRows,
      postgresSources: science.sources.length,
      sourceMappings: science.sourceSubstances.length,
      jsonStudies: science.jsonStudyRows,
      postgresStudies: science.studies.length,
      studyMappings: science.studySubstances.length,
      studySources: science.studySources.length,
      claims: claims.claims.length,
      claimSources: claims.claimSources.length,
      claimsWithSources: claims.claimsWithSources,
      claimsWithoutSources: claims.claimsWithoutSources,
      evidenceAssessments: claims.evidenceAssessments.length,
      evidenceOverlayAF: evidenceWithLevel.length,
      evidenceReviewRequired: evidenceReviewRequired.length,
      regulatoryRecords: regulatory.records.length,
      regulatoryHistory: regulatory.history.length,
      reviewActions: regulatory.reviewActions.length,
      reviewItems: jsonReviewItems.length,
      publishedProfiles: profiles.length,
    },
    identityParity,
    aliasParity,
    sourceParity,
    studyParity,
    claimParity,
    regulatorySourceParity,
    reviewParity,
    hudson: {
      excluded: [...EXCLUDED_STUDY_NCTS],
      publishedStudyRows: publishedHudsonStudies.length,
      publishedSourceRows: publishedHudsonSources.length,
      postgresStudyRows: seedHudsonStudies.length,
      postgresSourceRows: seedHudsonSources.length,
      claimHits: claims.hudsonHits.length,
    },
    communitySources: communitySources.length,
    orphans: {
      sourceWithoutSubstance: sourceWithoutSubstance.length,
      studyWithoutSubstance: studyWithoutSubstance.length,
      studyWithoutSource: studyWithoutSource.length,
      claimsWithoutSources: claims.claimsWithoutSources,
      evidenceWithoutClaim: claims.evidenceAssessments.length - claims.claims.length,
      regulatoryWithoutSource: regulatoryWithoutSource.length,
    },
    mappingNotes: {
      clientPrefixRules: PRODUCT_CODE_PREFIX_RULES.length,
      sqlCopiesPrefixPlusGlowName: true,
      clientFuzzyNameNotInSql: true,
    },
    contentReadiness,
    lexiconSwitchReadiness: "NOT_READY" as MigrationReadiness,
    deployedMigrationsAppliedThrough: "0023",
  };
}
