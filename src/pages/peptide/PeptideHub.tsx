import * as React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calculator } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { PEPTIDE_NAV_LABEL } from "@/lib/navigation";
import { SAFETY_DISCLAIMER } from "@/lib/peptide/catalog";

export default function PeptideHubPage() {
  React.useEffect(() => {
    document.title = `${PEPTIDE_NAV_LABEL} | Peptix`;
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Wissen"
        title={PEPTIDE_NAV_LABEL}
        description="Wissenschaftliche Informationen, aktuelle Forschung und praktische Berechnungstools rund um Peptide und verwandte Wirkstoffe."
      />

      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{SAFETY_DISCLAIMER}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <HubCard
          to="/peptide/rechner"
          icon={Calculator}
          title="Peptid Rechner"
          body="Konzentration, Rekonstitution und Einheiten mathematisch berechnen."
          action="Rechner öffnen"
        />
        <HubCard
          to="/peptide/lexikon"
          icon={BookOpen}
          title="Peptid Lexikon"
          body="Wirkmechanismen, Forschung, Sicherheit und aktuelle Evidenz entdecken."
          action="Lexikon öffnen"
        />
      </div>
    </div>
  );
}

function HubCard({
  to,
  icon: Icon,
  title,
  body,
  action,
}: {
  to: string;
  icon: typeof Calculator;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border/70 bg-card p-6 transition-colors hover:border-primary/40"
    >
      <Icon className="mb-4 h-5 w-5 text-primary" />
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span className="mt-5 inline-flex text-sm font-medium text-primary group-hover:underline">{action}</span>
    </Link>
  );
}
