import * as React from "react";
import { Link } from "react-router-dom";

import { LexiconSectionCard } from "@/components/peptide/lexicon/LexiconSectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { solventVolumeMl } from "@/lib/peptide/lexiconV2/reconstitution";
import type { ReconstitutionProfileData, ReconstitutionSolventType } from "@/lib/peptide/lexiconV2/types";

const SOLVENT_LABELS: Record<ReconstitutionSolventType, string> = {
  "bac-water": "BAC Water",
  "aa-water": "AA Water",
};

function formatConcentration(mgPerMl: number): string {
  if (!Number.isFinite(mgPerMl) || mgPerMl <= 0) return "—";
  const rounded = Math.round(mgPerMl * 100) / 100;
  return `${rounded} mg/ml`;
}

export function LexiconReconstitutionPanel({
  slug,
  displayNameDe,
  data,
}: {
  slug: string;
  displayNameDe: string;
  data: ReconstitutionProfileData;
}) {
  const rule = data.rule;
  const firstOption = data.vialOptions[0];
  const defaultVial =
    data.vialOptions.find((option) => option.amountMg != null)?.amountMg ??
    firstOption?.amountMg ??
    10;

  const [vialMg, setVialMg] = React.useState(String(firstOption?.amountMg ?? defaultVial));
  const [selectedLabel, setSelectedLabel] = React.useState(firstOption?.label ?? "");
  const [solvent, setSolvent] = React.useState<ReconstitutionSolventType>(rule?.solventType ?? "bac-water");

  const parsedMg = Number(vialMg.replace(",", "."));
  const volumeMl = rule && Number.isFinite(parsedMg) && parsedMg > 0 ? solventVolumeMl(parsedMg, rule) : null;
  const concentration =
    volumeMl != null && volumeMl > 0 && Number.isFinite(parsedMg) ? parsedMg / volumeMl : null;

  const calculatorHref =
    Number.isFinite(parsedMg) && parsedMg > 0
      ? `/peptide/rechner?vialMg=${parsedMg}&name=${encodeURIComponent(displayNameDe)}`
      : `/peptide/rechner?name=${encodeURIComponent(displayNameDe)}`;

  return (
    <LexiconSectionCard title="Rekonstitution">
      <p>{data.noteDe}</p>
      <p className="text-xs">{data.calculatorDisclaimerDe}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${slug}-vial`}>Peptid / Vialmenge</Label>
          {data.vialOptions.length > 0 ? (
            <Select
              value={selectedLabel}
              onValueChange={(label) => {
                setSelectedLabel(label);
                const option = data.vialOptions.find((row) => row.label === label);
                if (option?.amountMg != null) setVialMg(String(option.amountMg));
              }}
            >
              <SelectTrigger id={`${slug}-vial`}>
                <SelectValue placeholder="Vial wählen" />
              </SelectTrigger>
              <SelectContent>
                {data.vialOptions.map((option) => (
                  <SelectItem key={option.label} value={option.label}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`${slug}-vial`}
              inputMode="decimal"
              value={vialMg}
              onChange={(event) => setVialMg(event.target.value)}
              placeholder="z. B. 10"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${slug}-solvent`}>Flüssigkeit</Label>
          <Select value={solvent} onValueChange={(value) => setSolvent(value as ReconstitutionSolventType)}>
            <SelectTrigger id={`${slug}-solvent`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bac-water">{SOLVENT_LABELS["bac-water"]}</SelectItem>
              <SelectItem value="aa-water">{SOLVENT_LABELS["aa-water"]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-secondary/30 p-4 text-sm">
        <p>
          <span className="font-medium text-foreground">{displayNameDe}</span>
          {Number.isFinite(parsedMg) && parsedMg > 0 ? ` · ${parsedMg} mg` : ""}
        </p>
        <p className="mt-1">
          Flüssigkeit: {volumeMl != null ? `${volumeMl} ml ${SOLVENT_LABELS[solvent]}` : "—"}
        </p>
        <p>Volumen: {volumeMl != null ? `${volumeMl} ml` : "—"}</p>
        <p>Konzentration: {concentration != null ? formatConcentration(concentration) : "—"}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Rechnerische Produktinformation – keine individuelle medizinische Dosierungsanweisung.
        </p>
      </div>

      <Button asChild variant="outline" size="sm">
        <Link to={calculatorHref}>Erweiterter Rechner</Link>
      </Button>
    </LexiconSectionCard>
  );
}
