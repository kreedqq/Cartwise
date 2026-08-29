import type { ProfileSource } from "@/lib/peptide/profiles/types";
import { ACCESS_DATE } from "@/lib/peptide/lexiconV2/contentEngine/constants";

export function pubmedSource(
  pmid: string,
  title: string,
  publisher: string | null = null,
  publicationDate: string | null = null,
): ProfileSource {
  return {
    id: `pmid-${pmid}`,
    title,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    publisher,
    publicationDate,
    accessDate: ACCESS_DATE,
    doi: null,
    pmid,
    clinicalTrialId: null,
    sourceType: "pubmed",
    sourceQuality: 5,
  };
}

export function clinicalTrialSource(nct: string, title: string): ProfileSource {
  return {
    id: `nct-${nct}`,
    title,
    url: `https://clinicaltrials.gov/study/${nct}`,
    publisher: "ClinicalTrials.gov",
    publicationDate: null,
    accessDate: ACCESS_DATE,
    doi: null,
    pmid: null,
    clinicalTrialId: nct,
    sourceType: "clinical_trial",
    sourceQuality: 4,
  };
}

export function fdaSource(id: string, title: string, url: string): ProfileSource {
  return {
    id: `fda-${id}`,
    title,
    url,
    publisher: "FDA",
    publicationDate: null,
    accessDate: ACCESS_DATE,
    doi: null,
    pmid: null,
    clinicalTrialId: null,
    sourceType: "regulatory",
    sourceQuality: 5,
  };
}

export function emaSource(id: string, title: string, url: string): ProfileSource {
  return {
    id: `ema-${id}`,
    title,
    url,
    publisher: "EMA",
    publicationDate: null,
    accessDate: ACCESS_DATE,
    doi: null,
    pmid: null,
    clinicalTrialId: null,
    sourceType: "regulatory",
    sourceQuality: 5,
  };
}

export function reviewSource(pmid: string, title: string, publisher: string | null): ProfileSource {
  const source = pubmedSource(pmid, title, publisher);
  return { ...source, sourceType: "review" };
}
