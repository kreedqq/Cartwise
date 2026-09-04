import { catalogNamesForSlug, familySlugForCatalogName, normalizeCatalogName } from "@/lib/peptide/shopCoverage/names";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

const OIL_SLUGS = new Set([
  "dhb-1-test-cyp",
  "test-base",
  "tren-base",
  "boldenone-cypionate",
  "testosterone-cypionate",
  "drostanolone-propionate",
  "drostanolone-enanthate",
  "estradiol-cypionate",
  "trenbolone-hexahydrobenzylcarbonate",
  "dht-stanolone",
  "ment",
  "nandrolone-decanoate",
  "testosterone-propionate",
  "nandrolone-phenylpropionate",
  "trenbolone-acetate",
  "trenbolone-enanthate",
  "stanozolol-oil",
  "stanozolol-water",
  "testosterone-suspension",
  "testosterone-enanthate",
  "testosterone-undecanoate",
  "boldenone-undecylenate",
  "methenolone-enanthate",
  "methenolone-acetate",
  "testosterone-600",
]);

const OIL_BLEND_SLUGS = new Set([
  "tritren-225",
  "mast-blend",
  "nandromix",
  "trenmix",
  "sustanon",
  "supertest",
]);

const ORAL_SLUGS = new Set([
  "5-amino-1mq",
  "t3",
  "t4",
  "aicar",
  "bam15",
  "metribolone",
  "clenbuterol",
  "clomiphene",
  "cabergoline",
  "turinabol",
  "dianabol",
  "dapoxetine",
  "anastrozole",
  "enclomiphene",
  "exemestane",
  "finasteride",
  "fluoxymesterone",
  "cardarine",
  "hydroxychloroquine",
  "isotretinoin",
  "ligandrol",
  "ivermectin",
  "letrozole",
  "methyl-1-testosterone",
  "ostarine",
  "ibutamoren",
  "methylene-blue",
  "minoxidil",
  "orforglipron",
  "oxymetholone",
  "mesterolone",
  "prednisone",
  "dnp",
  "rad140",
  "andarine",
  "sr9009",
  "salbutamol",
  "methasterone",
  "sildenafil",
  "tadalafil",
  "dutasteride",
  "tamoxifen",
  "tesofensine",
  "telmisartan",
  "stanozolol-oral",
  "oxandrolone",
  "yk11",
  "slu-pp-332",
  "methylstenbolone",
]);

const PEPTIDE_BLEND_SLUGS = new Set([
  "bpc-tb500-blend",
  "glow-blend",
  "klow-blend",
  "cjc-ipamorelin-blend",
  "cagrilintide-semaglutide-blend",
  "retatrutide-cagrilintide-blend",
  "tesamorelin-ipamorelin-blend",
  "semax-selank-blend",
  "slu-pp-332-bam15-blend",
  "blend-opaque",
]);

const OTHER_SLUGS = new Set([
  "b12",
  "cerebrolysin",
  "epo",
  "glutathione",
  "hyaluronic-acid",
  "alprostadil",
  "botulinum-toxin",
  "cock-bombs",
  "ggh",
  "hhb",
  "shb",
  "lc-opaque",
  "ripex",
]);

export function isReconstitutionWaterName(name: string): boolean {
  const key = normalizeCatalogName(name);
  return key === "bac water" || key === "aa water";
}

export function isOpaqueCatalogName(name: string): boolean {
  const slug = familySlugForCatalogName(name);
  return (
    slug === "blend-opaque" ||
    slug === "cock-bombs" ||
    slug === "ggh" ||
    slug === "hhb" ||
    slug === "shb" ||
    slug === "lc-opaque" ||
    slug === "ripex"
  );
}

export function isExactCatalogName(name: string): boolean {
  return catalogNamesForSlug(familySlugForCatalogName(name)).length > 0;
}

export function isInjectableOilCatalogName(name: string): boolean {
  if (isReconstitutionWaterName(name)) return false;
  const slug = familySlugForCatalogName(name);
  return OIL_SLUGS.has(slug) || OIL_BLEND_SLUGS.has(slug);
}

export function isOralCatalogName(name: string): boolean {
  return ORAL_SLUGS.has(familySlugForCatalogName(name));
}

export function coverageCategoryForName(name: string): ShopCoverageCategory {
  if (isReconstitutionWaterName(name)) return "HILFSSTOFFE";

  const slug = familySlugForCatalogName(name);
  if (PEPTIDE_BLEND_SLUGS.has(slug) || OIL_BLEND_SLUGS.has(slug)) return "BLENDS";
  if (OIL_SLUGS.has(slug)) return "OILS / INJECTABLES";
  if (ORAL_SLUGS.has(slug)) return "ORALS";
  if (OTHER_SLUGS.has(slug)) return "SONSTIGE";
  if (catalogNamesForSlug(slug).length > 0) return "PEPTIDES";
  return "SONSTIGE";
}

export function substanceLabelForSlug(slug: string, name: string): string {
  const catalogNames = catalogNamesForSlug(slug);
  if (catalogNames.length > 0) return catalogNames[0];
  return name.trim();
}
