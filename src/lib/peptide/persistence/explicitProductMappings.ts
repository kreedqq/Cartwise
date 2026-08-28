/**
 * Explicit live-SKU → substance rows for product_substances (mapping_method = manual).
 * Codes and names are from cartwise-prod products (2026-08-28). No invented SKUs.
 */

export interface ExplicitProductMap {
  code: string;
  name: string;
  slug: string;
}

export interface UnresolvedProductMap {
  code: string;
  name: string;
  reason: string;
}

/** High-confidence: live code + name uniquely identify one catalog substance. */
export const EXPLICIT_PRODUCT_MAPPINGS: readonly ExplicitProductMap[] = [
  { code: "TR5", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR10", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR15", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR20", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR30", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR40", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR50", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR60", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR100", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR120", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "TR500", name: "Tirzepatide", slug: "tirzepatide" },
  { code: "SMO5", name: "Sermorelin Acetate", slug: "sermorelin" },
  { code: "SMO10", name: "Sermorelin Acetate", slug: "sermorelin" },
  { code: "SMO15", name: "Sermorelin Acetate", slug: "sermorelin" },
  { code: "TA5", name: "Thymosin Alpha-1", slug: "thymosin-alpha-1" },
  { code: "TA10", name: "Thymosin Alpha-1", slug: "thymosin-alpha-1" },
  { code: "ML10", name: "MT-2 (Melanotan 2 Acetate)", slug: "melanotan-ii" },
  { code: "SMM3", name: "Semaglutide", slug: "semaglutide" },
  { code: "SMM7", name: "Semaglutide", slug: "semaglutide" },
  { code: "LL5", name: "Liraglutide", slug: "liraglutide" },
  { code: "LL10", name: "Liraglutide", slug: "liraglutide" },
  { code: "LL30", name: "Liraglutide", slug: "liraglutide" },
  { code: "IP2", name: "Ipamorelin", slug: "ipamorelin" },
  { code: "IP5", name: "Ipamorelin", slug: "ipamorelin" },
  { code: "IP10", name: "Ipamorelin", slug: "ipamorelin" },
  { code: "CU50", name: "GHK-CU", slug: "ghk-cu" },
  { code: "CU100", name: "GHK-CU", slug: "ghk-cu" },
  { code: "ORF6", name: "Orforglipron", slug: "orforglipron" },
  { code: "ORF12", name: "Orforglipron", slug: "orforglipron" },
  { code: "GND2", name: "Gonadorelin", slug: "gonadorelin" },
  { code: "TSM5", name: "Tesamorelin", slug: "tesamorelin" },
  { code: "TSM10", name: "Tesamorelin", slug: "tesamorelin" },
  { code: "TSM20", name: "Tesamorelin", slug: "tesamorelin" },
  { code: "CGL5", name: "Cagrilintide", slug: "cagrilintide" },
  { code: "CGL10", name: "Cagrilintide", slug: "cagrilintide" },
  { code: "CGL20", name: "Cagrilintide", slug: "cagrilintide" },
  { code: "MDT5", name: "Mazdutide", slug: "mazdutide" },
  { code: "MDT10", name: "Mazdutide", slug: "mazdutide" },
  { code: "SK5", name: "Selank", slug: "selank" },
  { code: "SK10", name: "Selank", slug: "selank" },
  { code: "SK30", name: "Selank", slug: "selank" },
  { code: "XA5", name: "Semax", slug: "semax" },
  { code: "XA10", name: "Semax", slug: "semax" },
  { code: "XA30", name: "Semax", slug: "semax" },
  { code: "MS10", name: "MOTS-C", slug: "mots-c" },
  { code: "MS40", name: "MOTS-C", slug: "mots-c" },
  { code: "KP5", name: "KPV", slug: "kpv" },
  { code: "KP10", name: "KPV", slug: "kpv" },
  { code: "KP500", name: "KPV", slug: "kpv" },
  { code: "CD2", name: "CJC-1295 With DAC", slug: "cjc-1295" },
  { code: "CD5", name: "CJC-1295 With DAC", slug: "cjc-1295" },
  { code: "CD10", name: "CJC-1295 With DAC", slug: "cjc-1295" },
  { code: "CND2", name: "CJC-1295 Without DAC", slug: "cjc-1295" },
  { code: "CND5", name: "CJC-1295 Without DAC", slug: "cjc-1295" },
  { code: "CND10", name: "CJC-1295 Without DAC", slug: "cjc-1295" },
  { code: "BC2", name: "BPC 157", slug: "bpc-157" },
  { code: "BC5", name: "BPC 157", slug: "bpc-157" },
  { code: "BC10", name: "BPC 157", slug: "bpc-157" },
  { code: "BC20", name: "BPC 157", slug: "bpc-157" },
  { code: "BC500", name: "BPC", slug: "bpc-157" },
  { code: "B157", name: "BPC157", slug: "bpc-157" },
  { code: "2AD", name: "AOD9604", slug: "aod-9604" },
  { code: "5AD", name: "AOD9604", slug: "aod-9604" },
  { code: "10AD", name: "AOD9604", slug: "aod-9604" },
  { code: "IG1", name: "IGF-1LR3", slug: "igf-1-lr3" },
  { code: "IG01", name: "IGF-1LR3", slug: "igf-1-lr3" },
  { code: "G2K", name: "HCG", slug: "hcg" },
  { code: "G5K", name: "HCG", slug: "hcg" },
  { code: "G10K", name: "HCG", slug: "hcg" },
  { code: "H06", name: "HGH", slug: "somatropin" },
  { code: "H10", name: "HGH", slug: "somatropin" },
  { code: "H12", name: "HGH", slug: "somatropin" },
  { code: "H15", name: "HGH", slug: "somatropin" },
  { code: "H24", name: "HGH", slug: "somatropin" },
  { code: "H36", name: "HGH", slug: "somatropin" },
  { code: "H50", name: "HGH", slug: "somatropin" },
];

export const UNRESOLVED_PRODUCT_MAPPINGS: readonly UnresolvedProductMap[] = [
  {
    code: "BT5",
    name: "TB-500 (Thymosin B4 Acetate)",
    reason: "Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.",
  },
  {
    code: "B10F",
    name: "TB-500 (FRAG)",
    reason: "Fragment label plus TB-500/TB4 mix; not mapped.",
  },
  {
    code: "BT10",
    name: "TB-500 (Thymosin B4 Acetate)",
    reason: "Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.",
  },
  {
    code: "BT20",
    name: "TB-500 (Thymosin B4 Acetate)",
    reason: "Shop label mixes TB-500 and Thymosin Beta-4; identities stay separate.",
  },
  {
    code: "MT1",
    name: "MT-1",
    reason: "Melanotan I is not Melanotan II; prefix ^MT[0-9] must not stand.",
  },
  {
    code: "KL80",
    name: "(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend",
    reason: "Klow is not the glow-blend identity (extra TB-500).",
  },
  {
    code: "BB10",
    name: "BPC157 5mg+TB500 5mg Blend",
    reason: "Two-substance blend; no blend identity slug.",
  },
  {
    code: "BB20",
    name: "BPC157 10mg+TB500 10mg Blend",
    reason: "Two-substance blend; no blend identity slug.",
  },
  {
    code: "BB500",
    name: "BPC 500mcg+TB500 500mcg Blend",
    reason: "Two-substance blend; no blend identity slug.",
  },
  {
    code: "RC10",
    name: "Retatrutide 5mg+Cagrilintide 5mg Blend",
    reason: "Two-substance blend; do not pick one INN.",
  },
  {
    code: "CS10",
    name: "Cagrilintide 5mg+Semaglutide 5mg Blend",
    reason: "Two-substance blend; do not pick one INN.",
  },
  {
    code: "CP10",
    name: "CJC-1295 without DAC 5mg + IPA 5mg Blend",
    reason: "Two-substance blend.",
  },
  {
    code: "CP20",
    name: "CJC-1295 without DAC 10mg + IPA 10mg",
    reason: "Two-substance blend.",
  },
  {
    code: "TI18",
    name: "Tesamorelin 12mg+Ipamorelin 6mg",
    reason: "Two-substance blend.",
  },
  {
    code: "XS20",
    name: "Semax 10mg+Selank 10mg",
    reason: "Two-substance blend.",
  },
  {
    code: "FR2",
    name: "HGH Fragment 176-191",
    reason: "Fragment is not somatropin.",
  },
  {
    code: "FR5",
    name: "HGH Fragment 176-191",
    reason: "Fragment is not somatropin.",
  },
  {
    code: "FR10",
    name: "HGH Fragment 176-191",
    reason: "Fragment is not somatropin.",
  },
  {
    code: "NSK30",
    name: "NA Selank amide",
    reason: "Modified analogue; not mapped to selank without a separate identity.",
  },
  {
    code: "NXA30",
    name: "NA Semax amide",
    reason: "Modified analogue; not mapped to semax without a separate identity.",
  },
];

/** Prefix-mapped codes that are identity-unsafe and must not remain after 0024. */
export const UNMAP_PREFIX_CODES: readonly string[] = ["MT1", "KL80"];
