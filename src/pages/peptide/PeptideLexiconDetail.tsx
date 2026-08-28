import * as React from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  COMMUNITY_DISCLAIMER,
  EVIDENCE_LABELS,
  NO_DATA,
  NO_RECONSTITUTION,
  NO_STANDARD_DOSE,
  REGULATORY_LABELS,
  SAFETY_DISCLAIMER,
  getSubstanceBySlug,
} from "@/lib/peptide/catalog";
import { parseMgStrength } from "@/lib/peptide/search";
import { groupVariantsBySubstance } from "@/lib/peptide/mapping";
import { formatReviewedDate, getPublishedProfile } from "@/lib/peptide/profiles";
import type { CitedText, ProfileSource } from "@/lib/peptide/profiles/types";
import { useShopProducts } from "@/hooks/useShopProducts";
import { redditConnector } from "@/research/connectors";

export default function PeptideLexiconDetailPage() {
  const { slug = "" } = useParams();
  const substance = getSubstanceBySlug(slug);
  const profile = getPublishedProfile(slug);
  const productsQuery = useShopProducts();
  const [redditMessage, setRedditMessage] = React.useState("Reddit community data temporarily unavailable.");

  React.useEffect(() => {
    if (!substance) return;
    document.title = `${substance.displayName} | Peptid Lexikon | Peptix`;
    const meta = document.querySelector('meta[name="description"]') ?? document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute(
      "content",
      `${substance.displayName}: wissenschaftliches Identitäts- und Quellenprofil im Peptix-Lexikon.`,
    );
    if (!meta.parentElement) document.head.appendChild(meta);
    const canonical = document.querySelector('link[rel="canonical"]') ?? document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", `${window.location.origin}/peptide/lexikon/${substance.slug}`);
    if (!canonical.parentElement) document.head.appendChild(canonical);
    const ogTitle = document.querySelector('meta[property="og:title"]') ?? document.createElement("meta");
    ogTitle.setAttribute("property", "og:title");
    ogTitle.setAttribute("content", `${substance.displayName} | Peptid Lexikon | Peptix`);
    if (!ogTitle.parentElement) document.head.appendChild(ogTitle);
    void redditConnector.search({ name: substance.name }).then((result) => setRedditMessage(result.message));
  }, [substance]);

  if (!substance) return <Navigate to="/peptide/lexikon" replace />;

  const mapped = groupVariantsBySubstance(productsQuery.data ?? []).get(substance.slug) ?? [];
  const firstMg = mapped.map((row) => parseMgStrength(row.strengthLabel)).find((value) => value != null);
  const calculatorTo = firstMg
    ? `/peptide/rechner?vialMg=${firstMg}&name=${encodeURIComponent(substance.displayName)}`
    : "/peptide/rechner";
  const sourceById = new Map((profile?.sources ?? []).map((source) => [source.id, source]));

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: substance.displayName,
            description: substance.description,
            dateModified: substance.lastReviewedAt ?? undefined,
          }),
        }}
      />
      <PageHeader
        eyebrow="Lexikon"
        title={substance.displayName}
        description={[...substance.aliases, ...substance.developmentNames].join(" · ") || "Keine Aliase hinterlegt"}
        actions={
          <Button asChild>
            <Link to={calculatorTo}>Im Rechner verwenden</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{CATEGORY_LABELS[substance.category]}</Badge>
        <Badge variant="outline">Evidence {substance.evidenceLevel}</Badge>
        <Badge variant={substance.regulatoryStatus.startsWith("approved") ? "success" : "warning"}>
          {REGULATORY_LABELS[substance.regulatoryStatus]}
        </Badge>
        <Badge variant="outline">Review: {substance.reviewStatus}</Badge>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{SAFETY_DISCLAIMER}</p>
      {substance.identityNote && <p className="text-sm leading-relaxed">{substance.identityNote}</p>}
      {substance.casNumber && (
        <p className="text-sm text-muted-foreground">CAS {substance.casNumber}</p>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Scientific Evidence</h2>
        <p className="text-sm text-muted-foreground">{EVIDENCE_LABELS[substance.evidenceLevel]}</p>
        <p className="text-sm text-muted-foreground">Confidence: {substance.confidenceLevel}</p>
        <p className="text-sm text-muted-foreground">
          Last scientifically reviewed: {formatReviewedDate(substance.lastReviewedAt)}
        </p>
        <p className="text-sm text-muted-foreground">
          Last research scan: {formatReviewedDate(substance.lastResearchScanAt)}
        </p>
      </section>

      {profile ? (
        <>
          <CitedBlock title="Overview" block={profile.summary.whatIsIt} sources={sourceById} />
          <CitedBlock title="Mechanism" block={profile.summary.mechanism} sources={sourceById} />
          <CitedBlock title="What has been studied" block={profile.summary.whatHasBeenStudied} sources={sourceById} />
          <CitedBlock title="Human Evidence" block={profile.summary.humanEvidence} sources={sourceById} />
          <CitedBlock title="Preclinical Evidence" block={profile.summary.preclinicalEvidence} sources={sourceById} />
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Effects</h2>
            <p className="text-sm text-muted-foreground">{NO_STANDARD_DOSE}</p>
            <CitedBlock title="" block={profile.summary.humanEvidence} sources={sourceById} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Side Effects / Safety</h2>
            <CitedParagraph block={profile.summary.safety} sources={sourceById} />
            {profile.safetyItems.map((item) => (
              <p key={item.text} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {item.domain} · {item.severity}:
                </span>{" "}
                {item.text} <CiteLinks ids={item.sourceIds} sources={sourceById} />
              </p>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Pharmacology</h2>
            {profile.pharmacology.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine numerischen PK-Werte ohne explizite Quellenangabe übernommen. {NO_DATA}
              </p>
            ) : (
              profile.pharmacology.map((row) => (
                <p key={row.field} className="text-sm">
                  {row.field}: {row.value} <CiteLinks ids={row.sourceIds} sources={sourceById} />
                </p>
              ))
            )}
          </section>
          <CitedBlock title="Current Research" block={profile.summary.currentResearch} sources={sourceById} />
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Clinical Trials</h2>
            {profile.studies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{NO_DATA}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {profile.studies.map((study) => (
                  <li key={study.clinicalTrialId}>
                    <a className="text-primary hover:underline" href={study.url} target="_blank" rel="noreferrer">
                      {study.clinicalTrialId}
                    </a>
                    {` · ${study.title}`}
                    <span className="block text-xs text-muted-foreground">
                      {[study.phase, study.status, study.sponsor, study.enrollment != null ? `n=${study.enrollment}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {profile.studies
                .filter((study) => study.startDate)
                .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
                .slice(0, 10)
                .map((study) => (
                  <li key={`tl-${study.clinicalTrialId}`}>
                    {study.startDate}: {study.clinicalTrialId} ({study.phase ?? "n/a"})
                  </li>
                ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Interactions</h2>
            {profile.interactions.map((item) => (
              <p key={item.text} className="text-sm text-muted-foreground">
                {item.category}: {item.text} <CiteLinks ids={item.sourceIds} sources={sourceById} />
              </p>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Reconstitution</h2>
            {profile.reconstitution ? (
              <CitedParagraph block={profile.reconstitution} sources={sourceById} />
            ) : (
              <p className="text-sm text-muted-foreground">{NO_RECONSTITUTION}</p>
            )}
          </section>
          <CitedBlock title="Unknown / open questions" block={profile.summary.unknowns} sources={sourceById} />
          {profile.conflicts.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Conflicting Evidence</h2>
              {profile.conflicts.map((item) => (
                <p key={item.topic} className="text-sm text-muted-foreground">
                  {item.topic}: {item.note} <CiteLinks ids={item.sourceIds} sources={sourceById} />
                </p>
              ))}
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{NO_DATA}</p>
      )}

      {mapped.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Zugeordnete Katalogvarianten</h2>
          <p className="text-sm text-muted-foreground">Nur Artikelcodes und Stärken. Keine Preise, kein Warenkorb.</p>
          <ul className="text-sm">
            {mapped.map((row) => (
              <li key={row.code}>
                {row.code}
                {row.strengthLabel ? ` · ${row.strengthLabel}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {substance.blendComponentSlugs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Blend-Bestandteile</h2>
          <ul className="text-sm">
            {substance.blendComponentSlugs.map((component) => (
              <li key={component}>
                <Link className="text-primary hover:underline" to={`/peptide/lexikon/${component}`}>
                  {component}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-5">
        <h2 className="text-lg font-semibold">Community Experience</h2>
        <p className="text-sm text-muted-foreground">{COMMUNITY_DISCLAIMER}</p>
        <p className="text-sm text-muted-foreground">{profile?.community.message ?? redditMessage}</p>
        <p className="text-xs text-muted-foreground">
          Community signal only. Last community scan: {formatReviewedDate(substance.lastCommunityScanAt)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sources</h2>
        {profile && profile.sources.length > 0 ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {profile.sources.map((source) => (
              <li key={source.id} id={source.id}>
                <a className="text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {[source.publisher, source.sourceType, source.pmid ? `PMID ${source.pmid}` : null, source.clinicalTrialId, `accessed ${source.accessDate}`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{NO_DATA}</p>
        )}
      </section>
    </div>
  );
}

function CitedBlock({
  title,
  block,
  sources,
}: {
  title: string;
  block: CitedText;
  sources: Map<string, ProfileSource>;
}) {
  return (
    <section className="space-y-2">
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
      <CitedParagraph block={block} sources={sources} />
    </section>
  );
}

function CitedParagraph({ block, sources }: { block: CitedText; sources: Map<string, ProfileSource> }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {block.text} <CiteLinks ids={block.sourceIds} sources={sources} />
    </p>
  );
}

function CiteLinks({ ids, sources }: { ids: string[]; sources: Map<string, ProfileSource> }) {
  return (
    <span className="whitespace-nowrap text-xs">
      {ids.map((id) => {
        const source = sources.get(id);
        const label = source?.clinicalTrialId ?? (source?.pmid ? `PMID ${source.pmid}` : id.replace(/^[a-z]+-/, "").slice(0, 12));
        return (
          <a key={id} className="ml-1 text-primary hover:underline" href={`#${id}`}>
            [{label}]
          </a>
        );
      })}
    </span>
  );
}
