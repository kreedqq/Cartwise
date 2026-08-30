import coverageCsv from "../../../docs/LEXICON_SHOP_COVERAGE.csv?raw";

export interface ProductVariantMeta {
  /** Normalized vial strength label, e.g. "100 mg". Null when not derivable from file data. */
  vialStrength: string | null;
  /** Number of vials in a kit when the product file explicitly states it. */
  kitSizeVials: number | null;
  /** Raw variant string from the uploaded product coverage file. */
  rawVariant: string;
}

const KIT_VIALS_RE = /x\s*(\d+)\s*vials?\b/i;
const VIAL_STRENGTH_RE =
  /^([\d.,]+\s*(?:mg|mcg|µg|ug|iu|ui|ml))\b(?:\s*\/\s*vial)?/i;
const CAPSULE_TABLET_RE = /\bx\s*\d+\s*(?:capsule|tablet)/i;

/** Parse the authoritative variant column from the shop product file. */
export function parseVariantColumn(raw: string): Pick<ProductVariantMeta, "vialStrength" | "kitSizeVials"> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") {
    return { vialStrength: null, kitSizeVials: null };
  }

  let kitSizeVials: number | null = null;
  const kitMatch = KIT_VIALS_RE.exec(trimmed);
  if (kitMatch) {
    const size = Number(kitMatch[1]);
    kitSizeVials = Number.isInteger(size) && size > 0 ? size : null;
  }

  const strengthSource = trimmed.replace(KIT_VIALS_RE, "").replace(/\s*\/\s*vial\s*/gi, "").trim();

  let vialStrength: string | null = null;
  const strengthMatch = VIAL_STRENGTH_RE.exec(strengthSource);
  if (strengthMatch) {
    vialStrength = normalizeStrengthToken(strengthMatch[1]);
  } else if (!CAPSULE_TABLET_RE.test(strengthSource)) {
    const bare = strengthSource.match(/^([\d.,]+\s*(?:mg|mcg|µg|ug|iu|ui|ml))\b/i);
    if (bare) vialStrength = normalizeStrengthToken(bare[1]);
  }

  return { vialStrength, kitSizeVials };
}

export function normalizeStrengthToken(token: string): string {
  const match = token.trim().match(/^([\d.,]+)\s*(mg|mcg|µg|ug|iu|ui|ml)$/i);
  if (!match) return token.trim();
  const unit = match[2]
    .toLowerCase()
    .replace("µg", "mcg")
    .replace("ug", "mcg");
  return `${match[1].replace(",", ".")} ${unit}`;
}

function normalizedVialStrength(
  product: { code: string; dosage_vial?: string | null; name: string },
): string | null {
  const raw = vialStrengthForProduct(product);
  if (!raw) return null;
  const parsed = parseVariantColumn(raw);
  if (parsed.vialStrength) return parsed.vialStrength;
  const withoutVialSuffix = raw.replace(/\s*\/\s*vial\s*/i, "").trim();
  return normalizeStrengthToken(withoutVialSuffix);
}

/**
 * Customer-facing vial kit label, e.g. "10x 20mg Vials".
 * Uses coverage kit size when available; falls back to strength-only for non-kit products.
 */
export function formatVialVariant(
  product: { code: string; dosage_vial?: string | null; name: string },
): string {
  const strength = normalizedVialStrength(product);
  if (!strength) return "Standard";

  const kitSize = kitSizeVialsForProduct(product);
  if (kitSize != null && kitSize > 0) {
    return `${kitSize}x ${strength} Vials`;
  }

  return strength;
}

function parseCoverageCsv(csv: string): Map<string, ProductVariantMeta> {
  const map = new Map<string, ProductVariantMeta>();
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return map;

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    if (cols.length < 8) continue;
    const code = cols[0]?.trim().toUpperCase();
    const rawVariant = cols[7]?.trim() ?? "";
    if (!code) continue;
    const parsed = parseVariantColumn(rawVariant);
    map.set(code, { ...parsed, rawVariant });
  }
  return map;
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

const COVERAGE_BY_CODE = parseCoverageCsv(coverageCsv);

export function variantMetaForCode(code: string): ProductVariantMeta | null {
  return COVERAGE_BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

export function vialStrengthForProduct(
  product: { code: string; dosage_vial?: string | null; name: string },
): string | null {
  const fromDb = product.dosage_vial?.trim();
  if (fromDb) return fromDb;

  const fromFile = variantMetaForCode(product.code)?.vialStrength;
  if (fromFile) return fromFile;

  return null;
}

export function kitSizeVialsForProduct(product: { code: string }): number | null {
  return variantMetaForCode(product.code)?.kitSizeVials ?? null;
}

export function isKitShareableProduct(product: { code: string }): boolean {
  const kitSize = kitSizeVialsForProduct(product);
  return kitSize != null && kitSize >= 2;
}

/** Products in a shop group that support kit sharing (explicit kit size in coverage data). */
export function kitShareableVariants<T extends { code: string }>(variants: readonly T[]): T[] {
  return variants.filter(isKitShareableProduct);
}

/** Dropdown label: readable kit variant, e.g. "10x 20mg Vials". */
export function variantStrengthLabel(
  product: { code: string; dosage_vial?: string | null; name: string },
): string {
  return formatVialVariant(product);
}

/** Product row title: "Name 100 mg" when single variant; name only when multi-variant. */
export function shopProductTitle(
  displayName: string,
  product: { code: string; dosage_vial?: string | null; name: string },
  hasMultipleVariants: boolean,
): string {
  if (hasMultipleVariants) return displayName;
  const variantLabel = formatVialVariant(product);
  return variantLabel !== "Standard" ? `${displayName} ${variantLabel}` : displayName;
}
