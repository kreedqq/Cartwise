import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import {
  calculateConcentration,
  calculateReconstitution,
  calculateVials,
  convertMassUnits,
  iuConversionUnavailable,
} from "@/lib/peptide/calculator";
import { MASS_UNITS, formatAmount, type MassUnit } from "@/lib/peptide/units";
import { NO_STANDARD_DOSE, SAFETY_DISCLAIMER } from "@/lib/peptide/catalog";

export default function PeptideCalculatorPage() {
  const [params] = useSearchParams();
  const presetMg = Number(params.get("vialMg") ?? "");
  const presetName = params.get("name") ?? "";

  React.useEffect(() => {
    document.title = "Peptid Rechner | Peptix";
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rechner"
        title="Peptid Rechner"
        description="Mathematische Umrechnungen für Masse und Volumen. Keine Dosierungsempfehlung."
        actions={
          <Button asChild variant="outline">
            <Link to="/peptide/lexikon">Zum Lexikon</Link>
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{SAFETY_DISCLAIMER}</p>
      {presetName && (
        <p className="text-sm text-muted-foreground">
          Übernommen aus dem Lexikon: <span className="text-foreground">{presetName}</span>
          {Number.isFinite(presetMg) && presetMg > 0 ? ` · Vial ${presetMg} mg` : ""}
        </p>
      )}

      <Tabs defaultValue="reconstitution">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="reconstitution">Rekonstitution</TabsTrigger>
          <TabsTrigger value="concentration">Konzentration</TabsTrigger>
          <TabsTrigger value="units">Einheiten</TabsTrigger>
          <TabsTrigger value="vial">Vial</TabsTrigger>
        </TabsList>
        <TabsContent value="reconstitution" className="mt-4">
          <ReconstitutionForm defaultVialMg={Number.isFinite(presetMg) && presetMg > 0 ? presetMg : undefined} />
        </TabsContent>
        <TabsContent value="concentration" className="mt-4">
          <ConcentrationForm />
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <UnitsForm />
        </TabsContent>
        <TabsContent value="vial" className="mt-4">
          <VialForm defaultVialMg={Number.isFinite(presetMg) && presetMg > 0 ? presetMg : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnitSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: MassUnit;
  onChange: (unit: MassUnit) => void;
}) {
  return (
    <select
      id={id}
      className="flex h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value as MassUnit)}
    >
      {MASS_UNITS.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 space-y-1 rounded-xl border border-border/70 bg-secondary/40 p-4 text-sm">{children}</div>;
}

function ReconstitutionForm({ defaultVialMg }: { defaultVialMg?: number }) {
  const [vialAmount, setVialAmount] = React.useState(String(defaultVialMg ?? "10"));
  const [vialUnit, setVialUnit] = React.useState<MassUnit>("mg");
  const [solventMl, setSolventMl] = React.useState("2");
  const [desiredAmount, setDesiredAmount] = React.useState("250");
  const [desiredUnit, setDesiredUnit] = React.useState<MassUnit>("mcg");
  const result = calculateReconstitution({
    vialAmount: Number(vialAmount),
    vialUnit,
    solventMl: Number(solventMl),
    desiredAmount: Number(desiredAmount),
    desiredUnit,
  });

  return (
    <div className="max-w-xl space-y-4">
      <Field label="Vial-Inhalt" id="vial">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Input id="vial" inputMode="decimal" value={vialAmount} onChange={(e) => setVialAmount(e.target.value)} />
          <UnitSelect id="vial-unit" value={vialUnit} onChange={setVialUnit} />
        </div>
      </Field>
      <Field label="Lösungsmittelvolumen (ml)" id="solvent">
        <Input id="solvent" inputMode="decimal" value={solventMl} onChange={(e) => setSolventMl(e.target.value)} />
      </Field>
      <Field label="Gewünschte Wirkstoffmenge" id="desired">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Input
            id="desired"
            inputMode="decimal"
            value={desiredAmount}
            onChange={(e) => setDesiredAmount(e.target.value)}
          />
          <UnitSelect id="desired-unit" value={desiredUnit} onChange={setDesiredUnit} />
        </div>
      </Field>
      {result.ok ? (
        <ResultBox>
          <p>
            Konzentration: {formatAmount(result.concentrationMgPerMl, "mg/ml")} ·{" "}
            {formatAmount(result.concentrationMcgPerMl, "mcg/ml")}
          </p>
          <p>Berechnetes Volumen: {formatAmount(result.volumeMl, "ml")}</p>
          <p>Spritzenvolumen: {formatAmount(result.volumeMl, "ml")}</p>
          <p className="pt-2 text-muted-foreground">{result.disclaimer}</p>
        </ResultBox>
      ) : (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
    </div>
  );
}

function ConcentrationForm() {
  const [mass, setMass] = React.useState("10");
  const [unit, setUnit] = React.useState<MassUnit>("mg");
  const [volume, setVolume] = React.useState("2");
  const result = calculateConcentration({ mass: Number(mass), massUnit: unit, volumeMl: Number(volume) });
  return (
    <div className="max-w-xl space-y-4">
      <Field label="Wirkstoffmenge" id="c-mass">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Input id="c-mass" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
          <UnitSelect id="c-unit" value={unit} onChange={setUnit} />
        </div>
      </Field>
      <Field label="Volumen (ml)" id="c-vol">
        <Input id="c-vol" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} />
      </Field>
      {result.ok ? (
        <ResultBox>
          <p>{formatAmount(result.mgPerMl, "mg/ml")} · {formatAmount(result.mcgPerMl, "mcg/ml")}</p>
          <p className="pt-2 text-muted-foreground">{result.disclaimer}</p>
        </ResultBox>
      ) : (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
    </div>
  );
}

function UnitsForm() {
  const [amount, setAmount] = React.useState("1");
  const [from, setFrom] = React.useState<MassUnit>("mg");
  const [to, setTo] = React.useState<MassUnit>("mcg");
  const result = convertMassUnits({ amount: Number(amount), from, to });
  const iu = iuConversionUnavailable();
  return (
    <div className="max-w-xl space-y-4">
      <Field label="Menge" id="u-amount">
        <Input id="u-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Von" id="u-from">
          <UnitSelect id="u-from" value={from} onChange={setFrom} />
        </Field>
        <Field label="Nach" id="u-to">
          <UnitSelect id="u-to" value={to} onChange={setTo} />
        </Field>
      </div>
      {result.ok ? (
        <ResultBox>
          <p>{formatAmount(result.value, result.unit)}</p>
          <p className="pt-2 text-muted-foreground">{result.disclaimer}</p>
        </ResultBox>
      ) : (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
      <p className="text-sm text-muted-foreground">{iu.message}</p>
    </div>
  );
}

function VialForm({ defaultVialMg }: { defaultVialMg?: number }) {
  const [vialAmount, setVialAmount] = React.useState(String(defaultVialMg ?? "10"));
  const [needed, setNeeded] = React.useState("25");
  const result = calculateVials({
    vialAmount: Number(vialAmount),
    vialUnit: "mg",
    neededAmount: Number(needed),
    neededUnit: "mg",
  });
  return (
    <div className="max-w-xl space-y-4">
      <Field label="Vial-Inhalt (mg)" id="v-vial">
        <Input id="v-vial" inputMode="decimal" value={vialAmount} onChange={(e) => setVialAmount(e.target.value)} />
      </Field>
      <Field label="Benötigte Menge (mg)" id="v-need">
        <Input id="v-need" inputMode="decimal" value={needed} onChange={(e) => setNeeded(e.target.value)} />
      </Field>
      {result.ok ? (
        <ResultBox>
          <p>Exakt: {formatAmount(result.vialsExact, "Vials")}</p>
          <p>Aufgerundet: {result.vialsRoundedUp}</p>
          <p>Restmenge nach Aufrunden: {formatAmount(result.leftoverMg, "mg")}</p>
          <p className="pt-2 text-muted-foreground">{result.disclaimer}</p>
          <p className="text-muted-foreground">{NO_STANDARD_DOSE}</p>
        </ResultBox>
      ) : (
        <p className="text-sm text-destructive">{result.message}</p>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
