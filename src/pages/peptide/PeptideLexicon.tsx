import * as React from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { EvidenceGradeBadge } from "@/components/peptide/lexicon/EvidenceGradeBadge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SAFETY_DISCLAIMER } from "@/lib/peptide/catalog";
import {
  LEXICON_V2_CATEGORY_FILTERS,
  LEXICON_V2_CATEGORY_LABELS,
  type LexiconV2CategoryFilter,
} from "@/lib/peptide/lexiconV2/publicTypes";
import { searchLexiconV2Entries } from "@/lib/peptide/lexiconV2/search";
import { useLexiconV2Catalog } from "@/hooks/useLexiconV2Catalog";

function subtitleForEntry(searchTerms: string[], displayNameDe: string): string {
  const aliases = searchTerms
    .filter((term) => term.toLowerCase() !== displayNameDe.toLowerCase() && !term.includes("-"))
    .slice(0, 3);
  return aliases.length > 0 ? aliases.join(" · ") : "Keine weiteren Namen hinterlegt";
}

export default function PeptideLexiconPage() {
  const { catalog } = useLexiconV2Catalog();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<LexiconV2CategoryFilter>("all");

  const items = React.useMemo(
    () => searchLexiconV2Entries(catalog.entries, query, category),
    [catalog.entries, query, category],
  );

  React.useEffect(() => {
    document.title = "Peptid Lexikon | Peptix";
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lexikon"
        title="Peptid Lexikon"
        description="Wirkstoffprofile, Forschungskontext und Community – getrennt von Shop und Preisen."
      />
      <p className="text-sm text-muted-foreground">{SAFETY_DISCLAIMER}</p>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Deutscher Name oder Wirkstoffname …"
        aria-label="Lexikon durchsuchen"
      />

      <div className="flex flex-wrap gap-1.5">
        {LEXICON_V2_CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setCategory(filter.id)}
            className={
              category === filter.id
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {items.length} von {catalog.entries.length} Profilen · keine Shoppreise
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((entry) => (
          <Link
            key={entry.slug}
            to={`/peptide/lexikon/${entry.slug}`}
            className="rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{LEXICON_V2_CATEGORY_LABELS[entry.category]}</Badge>
              <EvidenceGradeBadge grade={entry.pdfEvidenceGrade} />
              {entry.publicationStatus === "draft" ? <Badge variant="outline">Entwurf</Badge> : null}
            </div>
            <h2 className="mt-3 text-base font-semibold tracking-tight">{entry.displayNameDe}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {subtitleForEntry(entry.searchTerms, entry.displayNameDe)}
            </p>
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{entry.shortDescriptionDe}</p>
            <span className="mt-3 inline-block text-sm font-medium text-primary">Profil öffnen</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
