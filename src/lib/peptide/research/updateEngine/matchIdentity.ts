import { getIdentitySubstance, PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";
import { identityMustStaySeparate, keepArticle, keepStudy } from "@/lib/peptide/research/sourceValidation";
import type { SubstanceIdentityRow } from "@/lib/peptide/research/updateEngine/types";

export const IDENTITY_BLEND_SLUG = "glow-blend";

const FORBIDDEN_TITLE: Array<{ slug: string; reject: RegExp; reason: string }> = [
  { slug: "melanotan-ii", reject: /afamelanotide|scenesse|ndp-msh/i, reason: "melanotan-ii-not-afamelanotide" },
  { slug: "igf-1-lr3", reject: /mecasermin|increlex/i, reason: "igf-1-lr3-not-mecasermin" },
  { slug: "hcg", reject: /ovitrelle|choriogonadotropin alfa|recombinant choriogonadotropin/i, reason: "urinary-hcg-not-ovitrelle" },
  { slug: "tb-500", reject: /thymosin beta[- ]?4(?! 17-23)/i, reason: "tb-500-not-thymosin-beta-4" },
];

export function identityCatalog(): SubstanceIdentityRow[] {
  return PEPTIDE_SUBSTANCES_IDENTITY.map((item) => ({
    slug: item.slug,
    name: item.name,
    aliases: [...item.aliases],
    developmentNames: [...item.developmentNames],
    casNumber: item.casNumber,
    moleculeType: item.moleculeType,
    blendComponentSlugs: item.blendComponentSlugs ? [...item.blendComponentSlugs] : [],
  }));
}

export function forbiddenIdentityReason(slug: string, title: string): string | null {
  const hit = FORBIDDEN_TITLE.find((row) => row.slug === slug && row.reject.test(title));
  if (hit) return hit.reason;
  if (slug === IDENTITY_BLEND_SLUG) return "glow-blend-not-a-unique-inn";
  return null;
}

export function cannotMergeSlugs(left: string, right: string): boolean {
  if (identityMustStaySeparate(left, right)) return true;
  const blend = getIdentitySubstance(IDENTITY_BLEND_SLUG);
  const components = blend?.blendComponentSlugs ?? ["ghk-cu", "tb-500", "bpc-157"];
  if (left === IDENTITY_BLEND_SLUG && components.includes(right)) return true;
  if (right === IDENTITY_BLEND_SLUG && components.includes(left)) return true;
  return false;
}

export function matchSubstance(input: {
  requestedSlug: string;
  title: string;
  kind: "article" | "study";
  catalog: SubstanceIdentityRow[];
}): { slug: string; confidence: "exact" | "alias" | "uncertain"; reason: string } {
  const requested = input.catalog.find((row) => row.slug === input.requestedSlug) ?? {
    slug: input.requestedSlug,
    name: input.requestedSlug,
    aliases: [],
    developmentNames: [],
    casNumber: null,
    moleculeType: null,
  };
  const forbidden = forbiddenIdentityReason(requested.slug, input.title);
  if (forbidden) {
    return { slug: requested.slug, confidence: "uncertain", reason: forbidden };
  }

  const kept =
    input.kind === "study"
      ? keepStudy(requested.slug, { title: input.title })
      : keepArticle(requested.slug, { title: input.title });
  if (!kept) {
    return { slug: requested.slug, confidence: "uncertain", reason: "identity-filter-rejected" };
  }

  const haystack = input.title.toLowerCase();
  const names = [requested.name, ...requested.aliases, ...requested.developmentNames].filter(Boolean);
  if (names.some((name) => haystack.includes(name.toLowerCase()) || haystack.includes(requested.slug.replace(/-/g, " ")))) {
    return { slug: requested.slug, confidence: "exact", reason: "name-or-alias" };
  }
  if (requested.casNumber && haystack.includes(requested.casNumber.toLowerCase())) {
    return { slug: requested.slug, confidence: "exact", reason: "cas" };
  }
  return { slug: requested.slug, confidence: "alias", reason: "requested-scope-kept" };
}
