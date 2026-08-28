import * as React from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, PEPTIDE_SUBSTANCES, REGULATORY_LABELS, SAFETY_DISCLAIMER } from "@/lib/peptide/catalog";
import { LEXICON_STATUS_FILTERS, matchesLexiconStatus, type LexiconStatusFilter } from "@/lib/peptide/lexiconFilters";
import { formatReviewedDate } from "@/lib/peptide/profiles";
import { searchSubstances } from "@/lib/peptide/search";
import type { PeptideCategory } from "@/lib/peptide/types";

const FILTERS: Array<{ id: "all" | PeptideCategory; label: string }> = [
  { id: "all", label: "Alle" },
  ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id: id as PeptideCategory, label })),
];

export default function PeptideLexiconPage() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<"all" | PeptideCategory>("all");
  const [status, setStatus] = React.useState<LexiconStatusFilter>("all");
  const items = React.useMemo(
    () => searchSubstances(query, category).filter((item) => matchesLexiconStatus(item, status)),
    [query, category, status],
  );

  React.useEffect(() => {
    document.title = "Peptid Lexikon | Peptix";
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lexikon"
        title="Peptid Lexikon"
        description="Substanzen, Aliase und Forschungsstatus. Wissenschaftliche Aussagen nur mit geprüften Quellen."
      />
      <p className="text-sm text-muted-foreground">{SAFETY_DISCLAIMER}</p>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name, Alias, Entwicklungsname …"
        aria-label="Lexikon durchsuchen"
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
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

      <div className="flex flex-wrap gap-1.5">
        {LEXICON_STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            className={
              status === filter.id
                ? "rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary"
                : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {items.length} von {PEPTIDE_SUBSTANCES.length} Profilen · keine Shoppreise
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.slug}
            to={`/peptide/lexikon/${item.slug}`}
            className="rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
              <Badge variant="outline">Evidence {item.evidenceLevel}</Badge>
            </div>
            <h2 className="mt-3 text-base font-semibold tracking-tight">{item.displayName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {[...item.aliases, ...item.developmentNames].slice(0, 3).join(" · ") || "Keine Aliase hinterlegt"}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Status: {REGULATORY_LABELS[item.regulatoryStatus]} · Evidence {item.evidenceLevel}
              {item.lastReviewedAt ? ` · Last reviewed: ${formatReviewedDate(item.lastReviewedAt)}` : " · Last reviewed: —"}
            </p>
            <span className="mt-3 inline-block text-sm font-medium text-primary">Profil öffnen</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
