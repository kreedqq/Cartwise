import type { MyShopArea } from "@/lib/shop/shopAreas";
import { isGroupBuyPricing } from "@/lib/shop/shopAreas";
import { parseAreaTheme } from "@/lib/shop/areaTheme";
import {
  parseAreaPortal,
  resolvePortalAccent,
  resolvePortalImageUrl,
  type AreaPortalConfig,
} from "@/lib/shop/portalTheme";
import { siteDesignImageUrl } from "@/services/siteDesign";

export function portalConfigFromAreaTheme(raw: unknown): AreaPortalConfig {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return parseAreaPortal(row.portal);
}

export function shopAreaPortalProps(area: MyShopArea) {
  const theme = parseAreaTheme(area.theme);
  const portal = portalConfigFromAreaTheme(area.theme);
  const accentHex = resolvePortalAccent(portal, theme.tokens.accent, theme.tokens.primary, area.key);
  const isGb = isGroupBuyPricing(area.pricing_profile);
  const title = theme.hub.title || area.name;
  const description =
    theme.hub.description ||
    area.subtitle ||
    (isGb ? "Gemeinsam kaufen · Kits · Anteile" : "Einzelverkauf · Vials · Packungen");
  const hubImage = theme.hub.image
    ? theme.hub.image.startsWith("http") || theme.hub.image.startsWith("/")
      ? theme.hub.image
      : siteDesignImageUrl(theme.hub.image)
    : null;

  return {
    theme,
    portal,
    accentHex,
    title,
    description,
    backgroundImageUrl: resolvePortalImageUrl(portal.backgroundImage) ?? hubImage,
    focalImageUrl: resolvePortalImageUrl(portal.image),
    metaLabel: isGb ? "Group Buy" : "Einzelverkauf",
    ctaLabel: "Betreten",
    disabled: area.status === "coming_soon",
  };
}
