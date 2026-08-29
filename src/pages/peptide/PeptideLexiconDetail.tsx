import * as React from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { LexiconCommunitySection } from "@/components/peptide/lexicon/LexiconCommunitySection";
import { LexiconReconstitutionPanel } from "@/components/peptide/lexicon/LexiconReconstitutionPanel";
import { LexiconSectionCard } from "@/components/peptide/lexicon/LexiconSectionCard";
import { LexiconSourcesSection } from "@/components/peptide/lexicon/LexiconSourcesSection";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { SAFETY_DISCLAIMER } from "@/lib/peptide/catalog";
import { germanDisplayNameForSlug } from "@/lib/peptide/lexiconV2/germanNames";
import { LEXICON_V2_CATEGORY_LABELS, type PublicLexiconEntry } from "@/lib/peptide/lexiconV2/publicTypes";
import { useLexiconV2Catalog } from "@/hooks/useLexiconV2Catalog";

export default function PeptideLexiconDetailPage() {
  const { slug = "" } = useParams();
  const { catalog } = useLexiconV2Catalog();
  const entry: PublicLexiconEntry | undefined = slug ? catalog.bySlug.get(slug) : undefined;

  React.useEffect(() => {
    if (!entry) return;
    document.title = `${entry.displayNameDe} | Peptid Lexikon | Peptix`;
    const meta = document.querySelector('meta[name="description"]') ?? document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      `${entry.displayNameDe}: Forschungsprofil im Peptix-Lexikon. Keine Preise, keine Dosierungsempfehlung.`,
    );
    if (!meta.parentElement) document.head.appendChild(meta);
  }, [entry]);

  if (!entry) return <Navigate to="/peptide/lexikon" replace />;

  const aliasLine = entry.searchTerms
    .filter((term: string) => term.toLowerCase() !== entry.displayNameDe.toLowerCase() && term !== entry.slug)
    .slice(0, 5)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lexikon"
        title={entry.displayNameDe}
        description={aliasLine || "Profil im Peptix-Lexikon"}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{LEXICON_V2_CATEGORY_LABELS[entry.category]}</Badge>
        {entry.publicationStatus === "draft" ? <Badge variant="outline">Entwurf</Badge> : null}
      </div>

      <p className="text-sm text-muted-foreground">{SAFETY_DISCLAIMER}</p>
      <p className="text-xs text-muted-foreground">Keine Preise · kein Warenkorb · keine Dosierungsempfehlung</p>

      {entry.identityNote ? (
        <p className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
          {entry.identityNote}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <LexiconSectionCard title="Kurz erklärt">
          <p>{entry.shortDescriptionDe}</p>
        </LexiconSectionCard>

        <LexiconSectionCard title="Wofür wird es verwendet bzw. untersucht?">
          <p>{entry.usesAndResearchDe}</p>
        </LexiconSectionCard>

        <LexiconSectionCard title="Mögliche Vorteile">
          <p>{entry.possibleBenefitsDe}</p>
        </LexiconSectionCard>

        <LexiconSectionCard title="Mögliche Nachteile / Nebenwirkungen">
          <p>{entry.possibleRisksDe}</p>
        </LexiconSectionCard>

        <LexiconSectionCard title="Anwendung / Darreichungsform">
          <p>{entry.applicationFormDe}</p>
        </LexiconSectionCard>

        {entry.reconstitution?.applicable && entry.reconstitution.rule ? (
          <LexiconReconstitutionPanel
            slug={entry.slug}
            displayNameDe={entry.displayNameDe}
            data={entry.reconstitution}
          />
        ) : null}
      </div>

      <LexiconSectionCard title="Aktuelle Studienlage">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground">Humanstudien</p>
            <p>{entry.studyLandscape.humanStudiesDe}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Präklinische Forschung</p>
            <p>{entry.studyLandscape.preclinicalDe}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Studienstatus</p>
            <p>{entry.studyLandscape.studyStatusDe}</p>
          </div>
        </div>
      </LexiconSectionCard>

      {entry.blendComponentSlugs.length > 0 ? (
        <LexiconSectionCard title="Blend-Bestandteile">
          <ul className="list-disc space-y-1 pl-5">
            {entry.blendComponentSlugs.map((componentSlug: string) => (
              <li key={componentSlug}>
                <Link className="text-primary hover:underline" to={`/peptide/lexikon/${componentSlug}`}>
                  {germanDisplayNameForSlug(componentSlug, componentSlug)}
                </Link>
              </li>
            ))}
          </ul>
        </LexiconSectionCard>
      ) : null}

      <LexiconCommunitySection
        slug={entry.slug}
        displayNameDe={entry.displayNameDe}
        searchTerms={entry.searchTerms}
        community={entry.community}
      />
      <LexiconSourcesSection sources={entry.sources} />
    </div>
  );
}
