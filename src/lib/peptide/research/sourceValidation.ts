/**
 * Official-source validation for research batches.
 * Does not invent NCT/PMID/approvals. Hudson and fictional CT.gov records stay unpublished.
 */

import { EXCLUDED_STUDY_NCTS, isExcludedNct, isFictionalOrExampleStudyTitle, normalizeNct } from "@/lib/peptide/persistence/identifiers";

export type StudyLike = {
  nctId?: string | null;
  title?: string | null;
  sponsor?: string | null;
  intervention?: string | null;
  condition?: string | null;
};

export type ArticleLike = {
  pmid?: string | null;
  title?: string | null;
};

export type SourceQualityClass =
  | "primary"
  | "secondary"
  | "regulatory"
  | "review"
  | "clinical_trial"
  | "database"
  | "other";

const HUDSON_SPONSOR = /hudson biotech/i;

export function isHudsonSponsor(sponsor: string | null | undefined): boolean {
  return HUDSON_SPONSOR.test(sponsor ?? "");
}

export function isHudsonExcludedNct(nctId: string | null | undefined): boolean {
  return isExcludedNct(nctId);
}

export function hudsonExcludedNcts(): readonly string[] {
  return EXCLUDED_STUDY_NCTS;
}

export function classifySourceQuality(input: {
  sourceType?: string | null;
  publisher?: string | null;
  pubtype?: string[] | null;
}): SourceQualityClass {
  const type = (input.sourceType ?? "").toLowerCase();
  const publisher = (input.publisher ?? "").toLowerCase();
  const pubtype = (input.pubtype ?? []).join(" ").toLowerCase();
  if (type === "regulatory" || publisher === "ema" || publisher === "fda" || /dailymed|drugs@fda|openfda/.test(publisher)) {
    return "regulatory";
  }
  if (type === "clinical_trial" || type === "clinicaltrial") return "clinical_trial";
  if (type === "database" || publisher.includes("pubchem")) return "database";
  if (type === "meta_analysis" || /meta-analysis/.test(pubtype)) return "review";
  if (type === "review" || /systematic review/.test(pubtype)) return "review";
  if (type === "pubmed" || /randomized|clinical trial|phase ii|phase iii|phase 2|phase 3/.test(pubtype)) {
    return "primary";
  }
  if (type === "scientific") return "other";
  if (type === "pubmed" || type === "journal") return "secondary";
  return "other";
}

export function keepStudy(slug: string, study: StudyLike): boolean {
  if (!study?.nctId || !/^NCT\d{8}$/.test(study.nctId)) return false;
  if (isExcludedNct(study.nctId)) return false;
  const title = study.title ?? "";
  if (isFictionalOrExampleStudyTitle(title)) return false;
  if (isHudsonSponsor(study.sponsor)) return false;
  if (slug === "ghk-cu" && !/ghk/i.test(title)) return false;
  if (slug === "ghk-cu" && /x39 patch/i.test(title)) return false;
  if (slug === "bpc-157" && /gummies/i.test(title)) return false;
  if (slug === "ipamorelin" && !/ipamorelin/i.test(title)) return false;
  if (slug === "tesamorelin" && !/tesamorelin|egrifta|th9507/i.test(title)) return false;
  if (slug === "retatrutide") return /retatrutide|ly3437943/i.test(title);
  if (slug === "tirzepatide") return /tirzepatide|ly3298176|mounjaro|zepbound/i.test(title);
  if (slug === "semaglutide") return /semaglutide|ozempic|wegovy|rybelsus/i.test(title);
  if (slug === "liraglutide") return /liraglutide|victoza|saxenda/i.test(title);
  if (slug === "cagrilintide") return /cagrilintide/i.test(title);
  if (slug === "mazdutide") return /mazdutide|ibi362|ly3305677/i.test(title);
  if (slug === "cjc-1295") return /cjc-?1295/i.test(title);
  if (slug === "aod-9604") return /aod-?9604/i.test(title);
  if (slug === "orforglipron" && !/orforglipron|ly3502970|foundayo/i.test(title)) return false;
  if (slug === "mots-c") {
    if (!/mots/i.test(title)) return false;
    if (/anesthesia|fasting|breast cancer|sglt2/i.test(title) && !/mots-c for /i.test(title)) return false;
    if (/platelet|b-amyloid|mortality of type/i.test(title)) return false;
  }
  if (slug === "tb-500" && /thymosin beta 4(?! 17-23)/i.test(title) && !/fragment/i.test(title)) return false;
  if (slug === "thymosin-beta-4") {
    if (/tb-500/i.test(title) && /fragment/i.test(title)) return false;
    return /thymosin beta|rgn-259|timbetasin|nl005/i.test(title);
  }
  if (slug === "thymosin-alpha-1") return /thymalfasin|thymosin.?alpha|tα1|ta1\b|zadaxin/i.test(title);
  if (slug === "sermorelin") return /sermorelin|geref/i.test(title);
  if (slug === "semax") return /semax/i.test(title);
  if (slug === "selank") return /selank/i.test(title);
  if (slug === "kpv") return /\bkpv\b|lys-pro-val|lysine-proline-valine/i.test(title);
  if (slug === "igf-1-lr3") return /lr3|long r3/i.test(title);
  if (slug === "melanotan-ii") return /melanotan/i.test(title) && !/afamelanotide|scenesse/i.test(title);
  if (slug === "gonadorelin") return /gonadorelin|factrel|lutrelef/i.test(title);
  if (slug === "hcg") return /chorionic gonadotropin|\bhcg\b|choriogonadotropin/i.test(title);
  if (slug === "somatropin") {
    return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  }
  return true;
}

export function keepArticle(slug: string, article: ArticleLike): boolean {
  const title = article.title ?? "";
  if (slug === "selank") return /selank/i.test(title);
  if (slug === "semax") return /semax/i.test(title);
  if (slug === "sermorelin") return /sermorelin|geref|ghrh\s*\(?1-29|grf\s*\(?1-29/i.test(title);
  if (slug === "melanotan-ii") return /melanotan/i.test(title) && !/afamelanotide|scenesse/i.test(title);
  if (slug === "igf-1-lr3") return /lr3|long r3/i.test(title) && !/sheep|rumen/i.test(title);
  if (slug === "kpv") return /\bkpv\b|lysine-proline-valine|lys-pro-val/i.test(title);
  if (slug === "thymosin-beta-4") return /thymosin\s*beta|tβ4|rgn-259|timbetasin/i.test(title) && !/tb-500/i.test(title);
  if (slug === "thymosin-alpha-1") return /thymosin\s*alpha|thymalfasin|zadaxin|tα1/i.test(title);
  if (slug === "gonadorelin") return /gonadorelin|factrel|lutrelef/i.test(title);
  if (slug === "hcg") return /chorionic gonadotropin|\bhcg\b|choriogonadotropin/i.test(title);
  if (slug === "somatropin") {
    return /somatropin|norditropin|omnitrope|humatrope|serostim|genotropin|nutropin|saizen/i.test(title);
  }
  if (slug === "retatrutide") return /retatrutide|ly3437943/i.test(title);
  if (slug === "tirzepatide") return /tirzepatide|ly3298176|mounjaro|zepbound/i.test(title);
  if (slug === "semaglutide") return /semaglutide|ozempic|wegovy|rybelsus/i.test(title);
  if (slug === "liraglutide") return /liraglutide|victoza|saxenda/i.test(title);
  if (slug === "cagrilintide") return /cagrilintide/i.test(title);
  if (slug === "mazdutide") return /mazdutide|ibi362|ly3305677/i.test(title);
  if (slug === "cjc-1295") return /cjc-?1295/i.test(title);
  if (slug === "aod-9604") return /aod-?9604/i.test(title);
  return Boolean(title);
}

export function identityMustStaySeparate(leftSlug: string, rightSlug: string): boolean {
  const pairs: Array<[string, string]> = [
    ["tb-500", "thymosin-beta-4"],
    ["melanotan-ii", "afamelanotide"],
    ["igf-1-lr3", "mecasermin"],
    ["hcg", "ovitrelle"],
  ];
  return pairs.some(
    ([a, b]) => (leftSlug === a && rightSlug === b) || (leftSlug === b && rightSlug === a),
  );
}

export function normalizeStudyNct(raw: string | null | undefined): string | null {
  return normalizeNct(raw);
}
