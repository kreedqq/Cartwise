/**
 * Deprecated on storefront: PEPTIX uses the global SiteBackground only.
 * Portals float on that layer — no per-area "portal world" stage.
 */
export function ShopPortalWorldBackground(_props: {
  accentHex?: string;
  className?: string;
  intensity?: "hub" | "area";
}) {
  return null;
}
