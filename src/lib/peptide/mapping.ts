import { parseStrengthLabel, substanceSlugForProduct } from "@/lib/peptide/search";
import type { PeptideProductRef } from "@/lib/peptide/types";

export function toProductRef(product: { code?: string | null; name?: string | null }): PeptideProductRef | null {
  const code = (product.code ?? "").trim();
  if (!code) return null;
  const slug = substanceSlugForProduct(product);
  if (!slug) return null;
  const name = (product.name ?? "").trim() || code;
  return {
    code,
    name,
    strengthLabel: parseStrengthLabel(name),
    substanceSlug: slug,
    blend: slug.endsWith("-blend") || / \+ /.test(name),
  };
}

export function groupVariantsBySubstance(
  products: Array<{ code?: string | null; name?: string | null }>,
): Map<string, PeptideProductRef[]> {
  const grouped = new Map<string, PeptideProductRef[]>();
  const seen = new Set<string>();
  for (const product of products) {
    const ref = toProductRef(product);
    if (!ref) continue;
    const key = ref.code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const list = grouped.get(ref.substanceSlug) ?? [];
    list.push(ref);
    grouped.set(ref.substanceSlug, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  }
  return grouped;
}
