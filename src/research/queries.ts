import type { PeptideSubstance } from "@/lib/peptide/types";

function quoted(term: string): string {
  return `"${term}"`;
}

/** Official-API search strings only. Never executed from the browser. */
export function scientificSearchTerms(substance: Pick<PeptideSubstance, "name" | "aliases" | "developmentNames">): string[] {
  const names = [substance.name, ...substance.aliases, ...substance.developmentNames].filter(Boolean);
  return Array.from(new Set(names));
}

export function pubmedQueryTemplates(name: string): string[] {
  return [
    name,
    `${name} safety`,
    `${name} adverse events`,
    `${name} pharmacokinetics`,
    `${name} clinical trial`,
    `${name} randomized trial`,
    `${name} systematic review`,
  ];
}

export function redditQueryTemplates(name: string): string[] {
  return [
    name,
    `${quoted(name)} experience`,
    `${quoted(name)} results`,
    `${quoted(name)} side effects`,
    `${quoted(name)} nausea`,
    `${quoted(name)} fatigue`,
    `${quoted(name)} appetite`,
    `${quoted(name)} effectiveness`,
  ];
}
