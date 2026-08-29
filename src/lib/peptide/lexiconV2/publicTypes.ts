import type { ProfileSource } from "@/lib/peptide/profiles/types";
import type { LexiconContentStatus } from "@/lib/peptide/lexiconV2/contentEngine/types";
import type {
  LexiconPublicationStatus,
  LexiconV2CommunityChannel,
  ReconstitutionProfileData,
} from "@/lib/peptide/lexiconV2/types";
import type { ShopCoverageCategory } from "@/lib/peptide/shopCoverage/types";

export interface PublicLexiconStudyLandscape {
  humanStudiesDe: string;
  preclinicalDe: string;
  studyStatusDe: string;
}

export interface PublicLexiconCommunityView {
  available: boolean;
  noticeDe: string;
  channels: LexiconV2CommunityChannel[];
}

export interface PublicLexiconEntry {
  slug: string;
  displayNameDe: string;
  category: ShopCoverageCategory;
  searchTerms: string[];
  publicationStatus: LexiconPublicationStatus;
  contentStatus: LexiconContentStatus;
  identityNote: string | null;
  shortDescriptionDe: string;
  usesAndResearchDe: string;
  possibleBenefitsDe: string;
  possibleRisksDe: string;
  applicationFormDe: string;
  reconstitution: ReconstitutionProfileData | null;
  studyLandscape: PublicLexiconStudyLandscape;
  community: PublicLexiconCommunityView;
  sources: ProfileSource[];
  blendComponentSlugs: string[];
}

export interface PublicLexiconV2Catalog {
  entries: PublicLexiconEntry[];
  bySlug: Map<string, PublicLexiconEntry>;
  publishedCount: number;
  draftCount: number;
  reviewRequiredFamilies: number;
  unknownFamilies: number;
}

export type LexiconV2CategoryFilter = "all" | ShopCoverageCategory;

export const LEXICON_V2_CATEGORY_FILTERS: Array<{ id: LexiconV2CategoryFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "PEPTIDES", label: "Peptide" },
  { id: "ORALS", label: "Orals" },
  { id: "OILS / INJECTABLES", label: "Oils / Injectables" },
  { id: "BLENDS", label: "Blends" },
  { id: "SONSTIGE", label: "Sonstige" },
];

export const LEXICON_V2_CATEGORY_LABELS: Record<ShopCoverageCategory, string> = {
  PEPTIDES: "Peptide",
  ORALS: "Orals",
  "OILS / INJECTABLES": "Oils / Injectables",
  BLENDS: "Blends",
  HILFSSTOFFE: "Hilfsstoffe",
  SONSTIGE: "Sonstige",
};
