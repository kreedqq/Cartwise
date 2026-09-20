import { ShopAreaPortal } from "@/components/shop/ShopAreaPortal";
import { AreaGlyph } from "@/lib/shop/areaIcons";
import { shopAreaPortalProps } from "@/lib/shop/areaPortal";
import { UI_TYPE } from "@/lib/design/tokens";
import type { MyShopArea } from "@/lib/shop/shopAreas";

export function ShopAreaPortalGallery({
  areas,
  heading = "Portal-Galerie",
  description,
}: {
  areas: readonly MyShopArea[];
  heading?: string;
  description?: string;
}) {
  if (areas.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="mx-auto max-w-2xl space-y-2 text-center sm:text-left">
        <p className={UI_TYPE.eyebrow}>PEPTIX</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-16">
        {areas.map((area, index) => {
          const copy = shopAreaPortalProps(area);
          return (
            <div key={area.key} className={index % 2 === 1 ? "lg:translate-y-8" : undefined}>
              <ShopAreaPortal
                layout="hub"
                href={area.path}
                title={copy.title}
                description={copy.description}
                accentHex={copy.accentHex}
                glow={copy.portal.glow}
                atmosphere={copy.portal.atmosphere}
                backgroundImageUrl={copy.backgroundImageUrl}
                portalAssetUrl={copy.portalAssetUrl}
                icon={<AreaGlyph iconKey={area.icon_key} className="h-5 w-5" />}
                badge={area.badge_text}
                metaLabel={copy.metaLabel}
                ctaLabel={copy.ctaLabel}
                disabled={copy.disabled}
                priorityImage={index === 0}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
