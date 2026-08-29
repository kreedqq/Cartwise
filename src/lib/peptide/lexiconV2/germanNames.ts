import { catalogNamesForSlug } from "@/lib/peptide/shopCoverage/names";

/** Preferred German display names where a standard form exists. */
const GERMAN_DISPLAY_OVERRIDES: Record<string, string> = {
  "5-amino-1mq": "5-Amino-1MQ",
  "aod-9604": "AOD-9604",
  "bpc-157": "BPC-157",
  "ghk-cu": "GHK-Cu",
  "igf-1-lr3": "IGF-1 LR3",
  hcg: "Humanes Choriongonadotropin (hCG)",
  somatropin: "Somatropin (HGH)",
  semaglutide: "Semaglutid",
  liraglutide: "Liraglutid",
  tirzepatide: "Tirzepatid",
  retatrutide: "Retatrutid",
  "melanotan-ii": "Melanotan II",
  "tb-500": "TB-500",
  "thymosin-beta-4": "Thymosin Beta-4",
  "thymosin-alpha-1": "Thymosin Alpha-1",
  clenbuterol: "Clenbuterol",
  turinabol: "Turinabol",
  dianabol: "Dianabol (Metandienon)",
  oxandrolone: "Oxandrolon (Anavar)",
  oxymetholone: "Oxymetholon (Anadrol)",
  "testosterone-enanthate": "Testosteron-Enantat",
  "testosterone-propionate": "Testosteron-Propionat",
  "testosterone-cypionate": "Testosteron-Cypionat",
  "testosterone-undecanoate": "Testosteron-Undecanoat",
  "boldenone-undecylenate": "Boldenon-Undecylenat (Equipoise)",
  "nandrolone-decanoate": "Nandrolon-Decanoat (DECA)",
  "nandrolone-phenylpropionate": "Nandrolon-Phenylpropionat (NPP)",
  "drostanolone-propionate": "Drostanolon-Propionat (Masteron P)",
  "drostanolone-enanthate": "Drostanolon-Enantat (Masteron E)",
  "trenbolone-acetate": "Trenbolon-Acetat",
  "trenbolone-enanthate": "Trenbolon-Enantat",
  finasteride: "Finasterid",
  dutasteride: "Dutasterid",
  tamoxifen: "Tamoxifen",
  anastrozole: "Anastrozol",
  exemestane: "Exemestan",
  letrozole: "Letrozol",
  sildenafil: "Sildenafil",
  tadalafil: "Tadalafil",
  minoxidil: "Minoxidil",
  ivermectin: "Ivermectin",
  glutathione: "Glutathion",
  "bac-water": "BAC Water",
  "aa-water": "AA Water",
  "klow-blend": "KLOW Blend",
  "glow-blend": "GLOW Blend",
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function germanDisplayNameForSlug(slug: string, fallbackLabel?: string): string {
  if (GERMAN_DISPLAY_OVERRIDES[slug]) return GERMAN_DISPLAY_OVERRIDES[slug];
  const catalog = catalogNamesForSlug(slug);
  if (catalog.length > 0) return catalog[0];
  if (fallbackLabel?.trim()) return fallbackLabel.trim();
  return titleFromSlug(slug);
}
