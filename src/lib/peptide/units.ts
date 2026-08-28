export const MASS_UNITS = ["g", "mg", "mcg", "ng"] as const;
export type MassUnit = (typeof MASS_UNITS)[number];

export const VOLUME_UNITS = ["ml"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

const MASS_TO_MG: Record<MassUnit, number> = {
  g: 1_000,
  mg: 1,
  mcg: 0.001,
  ng: 0.000_001,
};

export function isMassUnit(value: string): value is MassUnit {
  return (MASS_UNITS as readonly string[]).includes(value);
}

export function toMilligrams(value: number, unit: MassUnit): number {
  return value * MASS_TO_MG[unit];
}

export function fromMilligrams(milligrams: number, unit: MassUnit): number {
  return milligrams / MASS_TO_MG[unit];
}

export function formatAmount(value: number, unit: string, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const places = abs >= 100 ? 2 : abs >= 1 ? 3 : digits;
  const rounded = Number(value.toFixed(places));
  return `${rounded} ${unit}`;
}
