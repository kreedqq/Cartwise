import { PEPTIDE_SUBSTANCES_IDENTITY } from "@/lib/peptide/catalog";

export type IdentityStatus = "active" | "deprecated" | "merged" | "placeholder" | "blend";
export type AliasType =
  | "common_name"
  | "development_name"
  | "abbreviation"
  | "chemical_name"
  | "brand_name"
  | "other";

export interface IdentitySeedRow {
  slug: string;
  name: string;
  displayName: string;
  category: string;
  moleculeType: string | null;
  chemicalClass: null;
  casNumber: null;
  identityNote: string | null;
  status: IdentityStatus;
  aliases: Array<{ alias: string; aliasType: AliasType }>;
  componentSlugs: string[];
}

/** Identity rows intended for Postgres Phase 1. Mirrors catalog.ts, not published.json. */
export function identitySeedFromCatalog(): IdentitySeedRow[] {
  return PEPTIDE_SUBSTANCES_IDENTITY.map((item) => ({
    slug: item.slug,
    name: item.name,
    displayName: item.displayName,
    category: item.category,
    moleculeType: item.moleculeType,
    chemicalClass: null,
    casNumber: null,
    identityNote: item.identityNote,
    status: item.moleculeType === "blend" || item.blendComponentSlugs.length > 0 ? "blend" : "active",
    aliases: [
      ...item.aliases.map((alias) => ({ alias, aliasType: "common_name" as const })),
      ...item.developmentNames.map((alias) => ({ alias, aliasType: "development_name" as const })),
    ],
    componentSlugs: [...item.blendComponentSlugs],
  }));
}

export function assertIdentitySeparations(rows: IdentitySeedRow[]): void {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  if (!bySlug.get("tb-500") || !bySlug.get("thymosin-beta-4")) {
    throw new Error("TB-500 and Thymosin Beta-4 must both exist as separate identities.");
  }
  if (bySlug.get("tb-500")?.slug === bySlug.get("thymosin-beta-4")?.slug) {
    throw new Error("TB-500 must not share a slug with Thymosin Beta-4.");
  }
  const aliases = rows.flatMap((row) => row.aliases.map((entry) => entry.alias.toLowerCase().trim()));
  if (aliases.includes("afamelanotide") || aliases.includes("scenesse")) {
    throw new Error("Melanotan II must not alias Afamelanotide/Scenesse.");
  }
  if (aliases.includes("mecasermin") || aliases.includes("increlex")) {
    throw new Error("IGF-1 LR3 must not alias Mecasermin/Increlex.");
  }
}
