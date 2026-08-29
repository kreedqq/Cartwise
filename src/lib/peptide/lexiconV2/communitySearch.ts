export interface CommunitySearchLink {
  id: string;
  label: string;
  url: string;
  hintDe: string;
}

export interface CommunitySearchTerms {
  primary: string;
  alternates: string[];
}

const BRAND_ALIASES: Record<string, string[]> = {
  semaglutide: ["Semaglutide", "Ozempic", "Wegovy"],
  tirzepatide: ["Tirzepatide", "Mounjaro", "Zepbound"],
  retatrutide: ["Retatrutide", "Reta", "LY3437943"],
  finasteride: ["Finasteride", "Propecia", "Proscar"],
  "ghk-cu": ["GHK-Cu", "GHK Cu", "Copper peptide", "Copper tripeptide"],
  "klow-blend": ["KLOW", "KLOW Blend", "KLOW-Blend"],
};

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function communitySearchTermsForProfile(input: {
  slug: string;
  displayNameDe: string;
  searchTerms: string[];
}): CommunitySearchTerms {
  const branded = BRAND_ALIASES[input.slug] ?? [];
  const alternates = uniqueTerms([
    input.displayNameDe,
    ...branded,
    ...input.searchTerms,
    input.slug.replace(/-/g, " "),
  ]).filter((term) => term.toLowerCase() !== input.displayNameDe.toLowerCase());

  const primary =
    branded[0] ??
    input.searchTerms.find((term) => /[a-z]/i.test(term) && term.length > 2) ??
    input.displayNameDe;

  return { primary, alternates: alternates.slice(0, 8) };
}

export function buildCommunitySearchLinks(terms: CommunitySearchTerms): CommunitySearchLink[] {
  const query = terms.primary;
  const altQuery = terms.alternates.slice(0, 3).join(" OR ");

  return [
    {
      id: "reddit",
      label: "Reddit durchsuchen",
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
      hintDe: "Öffentliche Reddit-Suche – Ergebnisse sind subjektive Nutzerberichte, keine klinische Evidenz.",
    },
    {
      id: "reddit-alt",
      label: "Reddit (Alias-Suche)",
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(altQuery || query)}`,
      hintDe: "Alternative Schreibweisen und Aliase – nur öffentlich zugängliche Beiträge.",
    },
    {
      id: "google-reddit",
      label: "Google: site:reddit.com",
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:reddit.com ${query}`)}`,
      hintDe: "Externe Google-Suche auf Reddit – kein Scraping, kein Login-Umgehen.",
    },
    {
      id: "google-forum",
      label: "Foren & Blogs suchen",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} forum experience`)}`,
      hintDe: "Öffentliche Foren und Erfahrungsberichte – Inhalte sind nicht von Peptix geprüft.",
    },
  ];
}

const CACHE_PREFIX = "peptix-community-search-v1:";

export function readCommunitySearchCache(slug: string): CommunitySearchLink[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CommunitySearchLink[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCommunitySearchCache(slug: string, links: CommunitySearchLink[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${slug}`, JSON.stringify(links));
  } catch {
    // Ignore quota / privacy mode errors.
  }
}
