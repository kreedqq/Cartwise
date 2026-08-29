import { describe, expect, it } from "vitest";

import {
  buildCommunitySearchLinks,
  communitySearchTermsForProfile,
} from "@/lib/peptide/lexiconV2/communitySearch";
import { lexiconUpdateProfileCount, lexiconUpdatableSlugsByCategory } from "@/lib/peptide/research/updateEngine";

describe("lexicon update scope", () => {
  it("includes all public lexicon profiles, not only 27 research substances", () => {
    expect(lexiconUpdateProfileCount()).toBeGreaterThanOrEqual(160);
    expect(lexiconUpdatableSlugsByCategory("ORALS").length).toBeGreaterThanOrEqual(40);
    expect(lexiconUpdatableSlugsByCategory("PEPTIDES").length).toBeGreaterThanOrEqual(60);
  });
});

describe("community search links", () => {
  it("builds profile-specific public search URLs without fake posts", () => {
    const terms = communitySearchTermsForProfile({
      slug: "retatrutide",
      displayNameDe: "Retatrutid",
      searchTerms: ["Retatrutid", "retatrutide", "Reta"],
    });
    expect(terms.primary.toLowerCase()).toContain("retatrutide");
    const links = buildCommunitySearchLinks(terms);
    expect(links.some((link) => link.url.includes("reddit.com/search"))).toBe(true);
    expect(links.every((link) => link.url.startsWith("https://"))).toBe(true);
    expect(links.every((link) => !link.url.includes("api"))).toBe(true);
  });

  it("supports finasteride aliases without merging identities", () => {
    const terms = communitySearchTermsForProfile({
      slug: "finasteride",
      displayNameDe: "Finasterid",
      searchTerms: ["Finasterid", "finasteride"],
    });
    expect(terms.alternates.join(" ").toLowerCase()).toMatch(/propecia|finasteride/);
  });
});
