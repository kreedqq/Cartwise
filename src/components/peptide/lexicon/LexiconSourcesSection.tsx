import { LexiconSectionCard } from "@/components/peptide/lexicon/LexiconSectionCard";
import type { ProfileSource } from "@/lib/peptide/profiles/types";

export function LexiconSourcesSection({ sources }: { sources: ProfileSource[] }) {
  if (sources.length === 0) {
    return (
      <LexiconSectionCard title="Quellen">
        <p>Für dieses Profil sind noch keine kuratierten Quellen hinterlegt.</p>
      </LexiconSectionCard>
    );
  }

  return (
    <LexiconSectionCard title="Quellen">
      <p className="text-xs">Wissenschaftliche Quellen gesammelt am Ende des Profils. Keine Dosierungsempfehlung.</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm text-foreground">
        {sources.map((source) => (
          <li key={source.id} id={source.id}>
            <a className="text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {[source.publisher, source.sourceType, source.pmid ? `PMID ${source.pmid}` : null, source.clinicalTrialId, source.accessDate ? `abgerufen ${source.accessDate}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ol>
    </LexiconSectionCard>
  );
}
