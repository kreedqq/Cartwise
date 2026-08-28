import { fromMilligrams, type MassUnit, toMilligrams } from "@/lib/peptide/units";

export type CalculatorOk<T> = { ok: true } & T;
export type CalculatorErr = { ok: false; message: string };
export type CalculatorResult<T> = CalculatorOk<T> | CalculatorErr;

function requirePositive(value: number, label: string): CalculatorErr | null {
  if (!Number.isFinite(value)) return { ok: false, message: `${label} ist ungültig.` };
  if (value < 0) return { ok: false, message: `${label} darf nicht negativ sein.` };
  if (value === 0) return { ok: false, message: `${label} muss größer als 0 sein.` };
  return null;
}

export interface ReconstitutionInput {
  vialAmount: number;
  vialUnit: MassUnit;
  solventMl: number;
  desiredAmount: number;
  desiredUnit: MassUnit;
}

export interface ReconstitutionOutput {
  concentrationMgPerMl: number;
  concentrationMcgPerMl: number;
  volumeMl: number;
  disclaimer: string;
}

export function calculateReconstitution(input: ReconstitutionInput): CalculatorResult<ReconstitutionOutput> {
  const vialErr = requirePositive(input.vialAmount, "Vial-Inhalt");
  if (vialErr) return vialErr;
  const solventErr = requirePositive(input.solventMl, "Lösungsmittelvolumen");
  if (solventErr) return solventErr;
  const desiredErr = requirePositive(input.desiredAmount, "Gewünschte Wirkstoffmenge");
  if (desiredErr) return desiredErr;

  const vialMg = toMilligrams(input.vialAmount, input.vialUnit);
  const desiredMg = toMilligrams(input.desiredAmount, input.desiredUnit);
  const concentrationMgPerMl = vialMg / input.solventMl;
  if (!Number.isFinite(concentrationMgPerMl) || concentrationMgPerMl === 0) {
    return { ok: false, message: "Konzentration kann nicht berechnet werden." };
  }
  const volumeMl = desiredMg / concentrationMgPerMl;
  if (!Number.isFinite(volumeMl) || volumeMl < 0) {
    return { ok: false, message: "Volumen kann nicht berechnet werden." };
  }

  return {
    ok: true,
    concentrationMgPerMl,
    concentrationMcgPerMl: concentrationMgPerMl * 1_000,
    volumeMl,
    disclaimer: "Berechnetes mathematisches Ergebnis. Keine individuelle medizinische Dosierungsempfehlung.",
  };
}

export interface ConcentrationInput {
  mass: number;
  massUnit: MassUnit;
  volumeMl: number;
}

export function calculateConcentration(
  input: ConcentrationInput,
): CalculatorResult<{ mgPerMl: number; mcgPerMl: number; disclaimer: string }> {
  const massErr = requirePositive(input.mass, "Wirkstoffmenge");
  if (massErr) return massErr;
  const volErr = requirePositive(input.volumeMl, "Volumen");
  if (volErr) return volErr;
  const mgPerMl = toMilligrams(input.mass, input.massUnit) / input.volumeMl;
  if (!Number.isFinite(mgPerMl)) return { ok: false, message: "Konzentration kann nicht berechnet werden." };
  return {
    ok: true,
    mgPerMl,
    mcgPerMl: mgPerMl * 1_000,
    disclaimer: "Berechnetes mathematisches Ergebnis.",
  };
}

export interface UnitConversionInput {
  amount: number;
  from: MassUnit;
  to: MassUnit;
}

export function convertMassUnits(
  input: UnitConversionInput,
): CalculatorResult<{ value: number; unit: MassUnit; disclaimer: string }> {
  const amountErr = requirePositive(input.amount, "Menge");
  if (amountErr) return amountErr;
  const value = fromMilligrams(toMilligrams(input.amount, input.from), input.to);
  if (!Number.isFinite(value)) return { ok: false, message: "Umrechnung nicht möglich." };
  return { ok: true, value, unit: input.to, disclaimer: "Berechnetes mathematisches Ergebnis." };
}

export interface VialInput {
  vialAmount: number;
  vialUnit: MassUnit;
  neededAmount: number;
  neededUnit: MassUnit;
}

export function calculateVials(
  input: VialInput,
): CalculatorResult<{ vialsExact: number; vialsRoundedUp: number; leftoverMg: number; disclaimer: string }> {
  const vialErr = requirePositive(input.vialAmount, "Vial-Inhalt");
  if (vialErr) return vialErr;
  const neededErr = requirePositive(input.neededAmount, "Benötigte Menge");
  if (neededErr) return neededErr;
  const vialMg = toMilligrams(input.vialAmount, input.vialUnit);
  const neededMg = toMilligrams(input.neededAmount, input.neededUnit);
  const vialsExact = neededMg / vialMg;
  if (!Number.isFinite(vialsExact)) return { ok: false, message: "Vial-Anzahl kann nicht berechnet werden." };
  const vialsRoundedUp = Math.ceil(vialsExact - 1e-12);
  const leftoverMg = vialsRoundedUp * vialMg - neededMg;
  return {
    ok: true,
    vialsExact,
    vialsRoundedUp,
    leftoverMg,
    disclaimer: "Berechnetes mathematisches Ergebnis. Keine individuelle medizinische Dosierungsempfehlung.",
  };
}

export function iuConversionUnavailable(): CalculatorErr {
  return {
    ok: false,
    message: "Keine substanzspezifische IU-Umrechnung hinterlegt. IU wird nicht geschätzt.",
  };
}
