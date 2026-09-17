import type { ConfidenceLevel } from "@/lib/importConfidence";

const PACK_PATTERN =
  /^(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|iu|ml|g)\s*[*x×]\s*(\d+)\s*(vials?|tablets?|tabs?|caps?|capsules?|packungen?)/i;

const SIMPLE_DOSAGE = /^(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|iu|ml|g)\b/i;

/**
 * Parses merchant variant strings like "5mg*10vials" into PEPTIX dosage_vial text.
 * Pack suffix (*10vials) is kit/pack size — not quantity discount.
 */
export function parseVariantPackString(raw: string | null | undefined): {
  dosageVial: string | null;
  confidence: ConfidenceLevel;
} {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { dosageVial: null, confidence: "low" };

  const pack = trimmed.match(PACK_PATTERN);
  if (pack) {
    const amount = pack[1].replace(",", ".");
    const unit = pack[2].toLowerCase() === "ug" ? "µg" : pack[2];
    const count = pack[3];
    const packNoun = pack[4].toLowerCase().startsWith("vial") ? "Vials" : "Packung";
    const label =
      packNoun === "Vials"
        ? `${amount} ${unit} × ${count} Vials`
        : `${amount} ${unit} × ${count} ${packNoun}`;
    return { dosageVial: label, confidence: "high" };
  }

  const simple = trimmed.match(SIMPLE_DOSAGE);
  if (simple) {
    return { dosageVial: trimmed, confidence: "medium" };
  }

  if (trimmed.length >= 3) {
    return { dosageVial: trimmed, confidence: "medium" };
  }

  return { dosageVial: null, confidence: "low" };
}
