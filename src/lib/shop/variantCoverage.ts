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
const ORAL_BOTTLE_CODES = new Set(["B1201", "B1210"]);
const ORAL_PACK_RE =
  /^([\d.,]+\s*(?:mg|mcg|µg|ug|iu|ui|ml))\s*[x×]\s*(\d+)\s*(tablets?|capsules?|pcs?|stück|stueck|stuck)\b/i;
const ORAL_BOTTLE_RE =
  /^([\d.,]+)\s*ml\s*[x×]\s*([\d.,]+)\s*mg\s*\/\s*ml(?:\s*[x×]\s*(\d+)\s*(flasche|bottle)s?)?$/i;

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

function localizeOralPackUnit(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (key.startsWith("tablet")) return "Tabletten";
  if (key.startsWith("capsule")) return "Kapseln";
  if (key === "pcs" || key === "pc" || key === "stück" || key === "stueck" || key === "stuck") return "Stück";
  if (key.startsWith("flasche") || key.startsWith("bottle")) return "Flasche";
  return null;
}

/**
 * Formats stored oral pack strings such as "50mg x 25tablets" without inventing
 * missing pack sizes. Returns null when the raw value is not an oral pack.
 */
export function formatOralVariantLabel(raw: string, code = ""): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") return null;
  if (/^blend$/i.test(trimmed)) return "Blend";

  const bottle = ORAL_BOTTLE_RE.exec(trimmed);
  if (bottle) {
    const volume = `${bottle[1].replace(",", ".")} ml`;
    const concentration = `${bottle[2].replace(",", ".")} mg/ml`;
    const explicitCount = bottle[3] ? Number(bottle[3]) : null;
    const sku = code.trim().toUpperCase();
    const packCount =
      explicitCount != null && Number.isInteger(explicitCount) && explicitCount > 0
        ? explicitCount
        : ORAL_BOTTLE_CODES.has(sku)
          ? 1
          : null;
    const packUnit = bottle[4] ? localizeOralPackUnit(bottle[4]) : packCount != null ? "Flasche" : null;
    if (packCount != null && packUnit) {
      return `${volume} × ${concentration} × ${packCount} ${packUnit}`;
    }
    return `${volume} × ${concentration}`;
  }

  const pack = ORAL_PACK_RE.exec(trimmed);
  if (!pack) return null;
  const strength = normalizeStrengthToken(pack[1]);
  const count = Number(pack[2]);
  const unit = localizeOralPackUnit(pack[3]);
  if (!unit || !Number.isInteger(count) || count <= 0) return null;
  return `${strength} × ${count} ${unit}`;
}

export function isOralCustomerLabel(label: string): boolean {
  if (label === "Blend") return true;
  return /×/.test(label) && /(Tabletten|Kapseln|Stück|Flasche)/.test(label);
}

function rawVariantSource(product: { code: string; dosage_vial?: string | null }): string {
  return product.dosage_vial?.trim() || variantMetaForCode(product.code)?.rawVariant?.trim() || "";
}

/**
 * Customer-facing variant label.
 * Peptides: "10x 20 mg Vials". Orals: "50 mg × 25 Tabletten". Oils: strength only.
 */
export function formatVialVariant(
  product: { code: string; dosage_vial?: string | null; name: string },
): string {
  const oral = formatOralVariantLabel(rawVariantSource(product), product.code);
  if (oral) return oral;

  const strength = normalizedVialStrength(product);
  if (!strength) return "Standard";

  const kitSize = kitSizeVialsForProduct(product);
  if (kitSize != null && kitSize > 0) {
    return `${kitSize}x ${strength} Vials`;
  }

  return strength;
}

/** Category-aware alias used by shop, cart, checkout, and orders. */
export function formatProductVariant(
  product: { code: string; dosage_vial?: string | null; name: string },
): string {
  return formatVialVariant(product);
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

export function isKitShareableProduct(_product: { code: string }): boolean {
  return true;
}

/** All active variants in a shop group can be shared via kit. */
export function kitShareableVariants<T extends { code: string }>(variants: readonly T[]): T[] {
  return [...variants];
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
  if (isOralCustomerLabel(variantLabel)) return displayName;
  return variantLabel !== "Standard" ? `${displayName} ${variantLabel}` : displayName;
}

/** Single-variant orals show pack size as its own line instead of concatenating it into the name. */
export function showsStandaloneVariantLabel(
  product: { code: string; dosage_vial?: string | null; name: string },
  hasMultipleVariants: boolean,
): boolean {
  if (hasMultipleVariants) return false;
  return isOralCustomerLabel(formatVialVariant(product));
}
