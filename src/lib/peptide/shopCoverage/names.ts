export function normalizeCatalogName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function slugifyCatalogName(name: string): string {
  const slug = normalizeCatalogName(name)
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unbenannt";
}

export function parseMgFromName(name: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*mg\b/i.exec(name);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseMcgFromName(name: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*mcg\b/i.exec(name);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Exact catalog-name groups. No fuzzy matching. */
export const EXACT_NAME_GROUPS: readonly { slug: string; names: readonly string[] }[] = [
  { slug: "aod-9604", names: ["AOD9604"] },
  { slug: "5-amino-1mq", names: ["5-amino-1mq"] },
  { slug: "dhb-1-test-cyp", names: ["DHB (1-Test Cyp)"] },
  { slug: "ss-31", names: ["SS-31"] },
  { slug: "t3", names: ["T3"] },
  { slug: "ll37", names: ["LL37"] },
  { slug: "tritren-225", names: ["TriTren 225mg"] },
  { slug: "t4", names: ["T4"] },
  { slug: "aa-water", names: ["AA Water"] },
  { slug: "adamax", names: ["Adamax"] },
  { slug: "adipotide", names: ["Adipotide"] },
  { slug: "ace-031", names: ["ACE-031"] },
  { slug: "aicar", names: ["AICAR", "Aicar"] },
  { slug: "ahk-cu", names: ["AHK-CU"] },
  { slug: "tb-500-frag", names: ["TB-500 (FRAG)"] },
  { slug: "b12", names: ["B12"] },
  { slug: "bpc-157", names: ["BPC157", "BPC 157", "BPC"] },
  { slug: "blend-opaque", names: ["BLEND 300mg", "BLEND 375mg", "BLEND 500mg"] },
  { slug: "cock-bombs", names: ["COCK BOMBS"] },
  { slug: "bac-water", names: ["BAC Water"] },
  { slug: "test-base", names: ["TEST BASE (NO Ester)"] },
  { slug: "bam15", names: ["BAM15"] },
  { slug: "bpc-tb500-blend", names: ["BPC157 5mg+TB500 5mg Blend", "BPC157 10mg+TB500 10mg Blend", "BPC 500mcg+TB500 500mcg Blend"] },
  { slug: "glow-blend", names: ["(GLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg Blend"] },
  { slug: "metribolone", names: ["Metribolone"] },
  { slug: "bronchogen", names: ["Bronchogen"] },
  { slug: "tren-base", names: ["Tren BASE"] },
  { slug: "boldenone-cypionate", names: ["BC (Boldenone Cyp)"] },
  { slug: "tb-500-tb4-mix", names: ["TB-500 (Thymosin B4 Acetate)"] },
  { slug: "testosterone-cypionate", names: ["TEST CYPIONATE"] },
  { slug: "cardiogen", names: ["Cardiogen"] },
  { slug: "clenbuterol", names: ["CLENBUTEROL"] },
  { slug: "cerebrolysin", names: ["Cerebrolysin"] },
  { slug: "cjc-1295", names: ["CJC-1295 With DAC", "CJC-1295 Without DAC"] },
  { slug: "clomiphene", names: ["Clomiphene"] },
  { slug: "cabergoline", names: ["Cabergoline"] },
  { slug: "cagrilintide", names: ["Cagrilintide"] },
  { slug: "cortagen", names: ["Cortagen"] },
  { slug: "cjc-ipamorelin-blend", names: ["CJC-1295 without DAC 5mg + IPA 5mg Blend", "CJC-1295 without DAC 10mg + IPA 10mg"] },
  { slug: "crystagen", names: ["Crystagen"] },
  { slug: "cagrilintide-semaglutide-blend", names: ["Cagrilintide 5mg+Semaglutide 5mg Blend"] },
  { slug: "turinabol", names: ["Turinabol"] },
  { slug: "ghk-cu", names: ["GHK-CU"] },
  { slug: "dianabol", names: ["DIANABOL", "DIANABOL (Methandranstenolone)"] },
  { slug: "drostanolone-propionate", names: ["Mast P (DP)"] },
  { slug: "drostanolone-enanthate", names: ["Mast E (DE)"] },
  { slug: "dapoxetine", names: ["dapoxetine"] },
  { slug: "anastrozole", names: ["ARIMIDEX"] },
  { slug: "dihexa", names: ["Dihexa"] },
  { slug: "mast-blend", names: ["MAST Blend 200mg"] },
  { slug: "dermorphin", names: ["Dermorphin"] },
  { slug: "dsip", names: ["DSIP"] },
  { slug: "tadalafil", names: ["Tadalafil (Cialis)"] },
  { slug: "dutasteride", names: ["Dutasteride"] },
  { slug: "epo", names: ["EPO"] },
  { slug: "estradiol-cypionate", names: ["Estradiol Cypionate"] },
  { slug: "enclomiphene", names: ["Androxal (Enclomiphene)"] },
  { slug: "epithalon", names: ["Epithalon"] },
  { slug: "exemestane", names: ["Aromasin (Exemestane)"] },
  { slug: "foxo4", names: ["FOXO4"] },
  { slug: "mgf", names: ["MGF"] },
  { slug: "peg-mgf", names: ["PEG MGF"] },
  { slug: "finasteride", names: ["Finasteride"] },
  { slug: "hgh-fragment-176-191", names: ["HGH Fragment 176-191"] },
  { slug: "fluoxymesterone", names: ["Fluoxymesterone (Halotestin)"] },
  { slug: "hcg", names: ["HCG"] },
  { slug: "ghrp-2", names: ["GHRP-2 Acetate"] },
  { slug: "cardarine", names: ["GW-501516 (Cardarine)"] },
  { slug: "ghrp-6", names: ["GHRP-6 Acetate"] },
  { slug: "hmg", names: ["HMG"] },
  { slug: "ggh", names: ["GGH"] },
  { slug: "gonadorelin", names: ["Gonadorelin"] },
  { slug: "glutathione", names: ["Glutathione"] },
  { slug: "somatropin", names: ["HGH"] },
  { slug: "trenbolone-hexahydrobenzylcarbonate", names: ["Tren Hex"] },
  { slug: "hyaluronic-acid", names: ["Hyaluronic acid"] },
  { slug: "dht-stanolone", names: ["DHT (Stanolone)"] },
  { slug: "hhb", names: ["HHB"] },
  { slug: "humanin", names: ["Humanin"] },
  { slug: "hexarelin", names: ["Hexarelin"] },
  { slug: "hydroxychloroquine", names: ["Hydroxychloroquine"] },
  { slug: "igf-1-lr3", names: ["IGF-1LR3"] },
  { slug: "ipamorelin", names: ["Ipamorelin"] },
  { slug: "isotretinoin", names: ["isotretinoin"] },
  { slug: "klow-blend", names: ["(KLOW) GHK-CU 50mg+TB500 10mg+BPC157 10mg+TB500 10mg Blend"] },
  { slug: "kpv", names: ["KPV"] },
  { slug: "kisspeptin-10", names: ["KissPeptin-10"] },
  { slug: "cartalax", names: ["Cartalax"] },
  { slug: "lc-opaque", names: ["LC500", "LC526", "LC653"] },
  { slug: "ligandrol", names: ["LGD-4033 (Ligandrol)"] },
  { slug: "livagen", names: ["Livagen"] },
  { slug: "liraglutide", names: ["Liraglutide"] },
  { slug: "ivermectin", names: ["Ivermectin"] },
  { slug: "letrozole", names: ["Letrozole"] },
  { slug: "methenolone-enanthate", names: ["Primobolan E"] },
  { slug: "methyl-1-testosterone", names: ["17a-Methyl-1-testosterone"] },
  { slug: "ostarine", names: ["Ostarine / MK-2866"] },
  { slug: "methenolone-acetate", names: ["Methenolone Acetate (Primobolan)"] },
  { slug: "ibutamoren", names: ["MK-677 (Ibutamoren)"] },
  { slug: "matrixyl", names: ["Matrixyl"] },
  { slug: "prostamax", names: ["Prostamax"] },
  { slug: "methylene-blue", names: ["Methylene Blue"] },
  { slug: "minoxidil", names: ["Minoxidil"] },
  { slug: "mazdutide", names: ["Mazdutide"] },
  { slug: "melanotan-ii", names: ["MT-2 (Melanotan 2 Acetate)"] },
  { slug: "ment", names: ["MENT (Testosterone Acetate)"] },
  { slug: "mots-c", names: ["MOTS-C"] },
  { slug: "methylstenbolone", names: ["Methylstenbolone"] },
  { slug: "melanotan-i", names: ["MT-1"] },
  { slug: "nandrolone-decanoate", names: ["DECA (ND)"] },
  { slug: "n-acetyl-epitalon-amidate", names: ["N-Acetyl Epitalon Amidate"] },
  { slug: "nad", names: ["NAD+"] },
  { slug: "nandromix", names: ["NANDROMIX 300mg"] },
  { slug: "snap-8", names: ["SNAP-8"] },
  { slug: "na-selank-amide", names: ["NA Selank amide"] },
  { slug: "na-semax-amide", names: ["NA Semax amide"] },
  { slug: "orforglipron", names: ["Orforglipron"] },
  { slug: "oxytocin", names: ["Oxytocin Acetate"] },
  { slug: "ovagen", names: ["Ovagen"] },
  { slug: "oxymetholone", names: ["ANADROL (Oxymetholone)", "ANADROL"] },
  { slug: "mesterolone", names: ["Proviron"] },
  { slug: "testosterone-propionate", names: ["TEST P"] },
  { slug: "p21", names: ["P21"] },
  { slug: "pt-141", names: ["PT-141"] },
  { slug: "pancragen", names: ["Pancragen"] },
  { slug: "prednisone", names: ["Prednisone"] },
  { slug: "pe-22-28", names: ["PE 22-28"] },
  { slug: "pinealon", names: ["Pinealon"] },
  { slug: "pnc-27", names: ["PNC 27"] },
  { slug: "nandrolone-phenylpropionate", names: ["NPP"] },
  { slug: "dnp", names: ["DNP"] },
  { slug: "alprostadil", names: ["Aprostadil"] },
  { slug: "trenbolone-acetate", names: ["Tren A"] },
  { slug: "rad140", names: ["RAD140"] },
  { slug: "trenbolone-enanthate", names: ["Tren E"] },
  { slug: "ara-290", names: ["ARA-290"] },
  { slug: "retatrutide-cagrilintide-blend", names: ["Retatrutide 5mg+Cagrilintide 5mg Blend"] },
  { slug: "trenmix", names: ["TRENMIX 200mg"] },
  { slug: "retatrutide", names: ["Retatrutide"] },
  { slug: "ripex", names: ["RIPEX"] },
  { slug: "andarine", names: ["Andarine S4"] },
  { slug: "sustanon", names: ["Sustanon 250mg", "Sustanon 400mg"] },
  { slug: "supertest", names: ["Supertest 450mg"] },
  { slug: "sr9009", names: ["SR9009"] },
  { slug: "salbutamol", names: ["SALBUTAMOL"] },
  { slug: "slu-pp-332-bam15-blend", names: ["slupp-332 250mcg+BAM15 50mcg"] },
  { slug: "methasterone", names: ["Superdrol", "Superdrol (Methyldrostanolone)"] },
  { slug: "sildenafil", names: ["Sildenafil (Viagra)"] },
  { slug: "shb", names: ["SHB"] },
  { slug: "selank", names: ["Selank"] },
  { slug: "slu-pp-332", names: ["SLU-PP-332"] },
  { slug: "semaglutide", names: ["Semaglutide"] },
  { slug: "sermorelin", names: ["Sermorelin Acetate"] },
  { slug: "stanozolol-oil", names: ["STANOZOLOL (Oil base) winstrol"] },
  { slug: "stanozolol-water", names: ["STANOZOLOL (Water) winstrol", "STANOZOLol (Water) winstrol"] },
  { slug: "testosterone-suspension", names: ["TEST SUSPENSION 100mg"] },
  { slug: "tamoxifen", names: ["Tamoxifen (Nolvadex)"] },
  { slug: "tesofensine", names: ["Tesofensine"] },
  { slug: "testosterone-600", names: ["Testo 600mg"] },
  { slug: "thymosin-alpha-1", names: ["Thymosin Alpha-1"] },
  { slug: "testosterone-enanthate", names: ["TEST ENANTHATE"] },
  { slug: "teriparatide", names: ["Teriparatide"] },
  { slug: "testagen", names: ["Testagen"] },
  { slug: "tesamorelin-ipamorelin-blend", names: ["Tesamorelin 12mg+Ipamorelin 6mg"] },
  { slug: "telmisartan", names: ["Telmisartan"] },
  { slug: "tirzepatide", names: ["Tirzepatide"] },
  { slug: "tesamorelin", names: ["Tesamorelin"] },
  { slug: "thymalin", names: ["Thymalin"] },
  { slug: "testosterone-undecanoate", names: ["TEST Undecanoate 300"] },
  { slug: "boldenone-undecylenate", names: ["BU (EQUIPOISE)"] },
  { slug: "vesugen", names: ["Vesugen"] },
  { slug: "vilon", names: ["Vilon"] },
  { slug: "vip", names: ["VIP"] },
  { slug: "stanozolol-oral", names: ["Winstrol (Stanozolol)"] },
  { slug: "oxandrolone", names: ["ANAVAR"] },
  { slug: "semax", names: ["Semax"] },
  { slug: "semax-selank-blend", names: ["Semax 10mg+Selank 10mg"] },
  { slug: "botulinum-toxin", names: ["Botulinum toxin"] },
  { slug: "yk11", names: ["YK11"] },
];

const NAME_TO_SLUG = new Map<string, string>();
for (const group of EXACT_NAME_GROUPS) {
  for (const name of group.names) {
    NAME_TO_SLUG.set(normalizeCatalogName(name), group.slug);
  }
}

export function familySlugForCatalogName(name: string): string {
  return NAME_TO_SLUG.get(normalizeCatalogName(name)) ?? slugifyCatalogName(name);
}

export function catalogNamesForSlug(slug: string): string[] {
  return EXACT_NAME_GROUPS.find((group) => group.slug === slug)?.names.slice() ?? [];
}
