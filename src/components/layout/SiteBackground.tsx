import { useSiteDesign } from "@/hooks/useTrustExperience";
import { designHasVisibleBackground, layerCss, resolvedDesignLayer } from "@/lib/siteDesign";
import { siteDesignImageUrl } from "@/services/siteDesign";

export function SiteBackground() {
  const query = useSiteDesign();
  const enabled = query.data?.enabled ?? false;
  const config = query.data?.config;
  if (!config || !designHasVisibleBackground(enabled, config)) return null;

  const desktop = resolvedDesignLayer(config, "desktop");
  const tablet = resolvedDesignLayer(config, "tablet");
  const mobile = resolvedDesignLayer(config, "mobile");
  const desktopUrl = siteDesignImageUrl(desktop.imagePath);
  const tabletUrl = siteDesignImageUrl(tablet.imagePath);
  const mobileUrl = siteDesignImageUrl(mobile.imagePath);
  const overlay = Math.max(desktop.overlayOpacity, tablet.overlayOpacity, mobile.overlayOpacity);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 hidden lg:block" style={layerCss(desktop, desktopUrl)} />
      <div className="absolute inset-0 hidden md:block lg:hidden" style={layerCss(tablet, tabletUrl)} />
      <div className="absolute inset-0 md:hidden" style={layerCss(mobile, mobileUrl)} />
      {desktop.overlay || tablet.overlay || mobile.overlay ? (
        <div className="absolute inset-0 bg-background" style={{ opacity: Math.min(0.85, overlay / 100) }} />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,hsl(var(--background)/0.55)_100%)]" />
    </div>
  );
}
