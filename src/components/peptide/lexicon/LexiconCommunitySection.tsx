import * as React from "react";

import { LexiconSectionCard } from "@/components/peptide/lexicon/LexiconSectionCard";
import { Button } from "@/components/ui/button";
import { COMMUNITY_DISCLAIMER } from "@/lib/peptide/catalog";
import {
  buildCommunitySearchLinks,
  communitySearchTermsForProfile,
  readCommunitySearchCache,
  writeCommunitySearchCache,
  type CommunitySearchLink,
} from "@/lib/peptide/lexiconV2/communitySearch";
import type { PublicLexiconCommunityView } from "@/lib/peptide/lexiconV2/publicTypes";
import type { CommunityChannelKind } from "@/lib/peptide/lexiconV2/types";

const CHANNEL_LABELS: Record<CommunityChannelKind, string> = {
  reddit: "Reddit",
  forum: "Forum",
  blog: "Blog",
  "user-report": "User Report",
};

export function LexiconCommunitySection({
  slug,
  displayNameDe,
  searchTerms,
  community,
}: {
  slug: string;
  displayNameDe: string;
  searchTerms: string[];
  community: PublicLexiconCommunityView;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [links, setLinks] = React.useState<CommunitySearchLink[]>(() => readCommunitySearchCache(slug) ?? []);

  const verifiedReports = community.channels.flatMap((channel) =>
    channel.reports.map((report) => ({ ...report, channel: channel.kind })),
  );

  const searchTermsResolved = React.useMemo(
    () => communitySearchTermsForProfile({ slug, displayNameDe, searchTerms }),
    [slug, displayNameDe, searchTerms],
  );

  function openSearch() {
    const nextLinks = buildCommunitySearchLinks(searchTermsResolved);
    setLinks(nextLinks);
    writeCommunitySearchCache(slug, nextLinks);
    setExpanded(true);
  }

  return (
    <LexiconSectionCard title="Community Erfahrungen">
      <p className="text-xs">{COMMUNITY_DISCLAIMER}</p>
      <p className="text-sm text-muted-foreground">
        Subjektive Nutzerberichte aus öffentlichen Quellen. Community-Erfahrungen erhöhen keine wissenschaftliche
        Evidenz und ersetzen keine Studienlage.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={openSearch}>
          Nutzererfahrungen suchen
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={openSearch}>
          Reddit &amp; Community durchsuchen
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-4">
          <p className="text-sm">
            Suche für <span className="font-medium text-foreground">{displayNameDe}</span>
            {searchTermsResolved.alternates.length > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · Aliase: {searchTermsResolved.alternates.slice(0, 4).join(", ")}
              </span>
            ) : null}
          </p>
          <ul className="space-y-2 text-sm">
            {(links.length > 0 ? links : buildCommunitySearchLinks(searchTermsResolved)).map((link) => (
              <li key={link.id} className="rounded-md border border-border/50 bg-background/60 px-3 py-2">
                <a className="font-medium text-primary hover:underline" href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
                <p className="text-xs text-muted-foreground">{link.hintDe}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Peptix speichert keine privaten Reddit-Accounts und importiert keine geschützten Beiträge. Ergebnisse
            stammen aus öffentlichen Suchlinks.
          </p>
        </div>
      ) : null}

      {verifiedReports.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Geprüfte Community-Quellen</p>
          <ul className="space-y-2 text-sm">
            {verifiedReports.map((report) => (
              <li key={report.id} className="rounded-md border border-border/50 px-3 py-2">
                <span className="text-xs uppercase text-muted-foreground">{CHANNEL_LABELS[report.channel]}</span>
                {" · "}
                {report.sourceUrl ? (
                  <a className="text-primary hover:underline" href={report.sourceUrl} target="_blank" rel="noreferrer">
                    {report.title}
                  </a>
                ) : (
                  report.title
                )}
                {report.excerpt ? <p className="text-xs text-muted-foreground">{report.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : expanded ? null : (
        <p className="text-sm text-muted-foreground">
          Noch keine geprüften Community-Einträge hinterlegt. Nutzen Sie die Suche für öffentliche Diskussionen.
        </p>
      )}
    </LexiconSectionCard>
  );
}
