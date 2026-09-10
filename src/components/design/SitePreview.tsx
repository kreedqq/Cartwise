import { Card, CardContent } from "@/components/ui/card";
import { layerCss, resolvedDesignLayer, type SiteDesignConfig } from "@/lib/siteDesign";
import { siteDesignImageUrl } from "@/services/siteDesign";
import { cn } from "@/lib/utils";

function PreviewChrome({
  config,
  viewport,
  className,
  label,
}: {
  config: SiteDesignConfig;
  viewport: "desktop" | "tablet" | "mobile";
  className?: string;
  label: string;
}) {
  const layer = resolvedDesignLayer(config, viewport);
  const url = layer.imagePath?.startsWith("blob:") ? layer.imagePath : siteDesignImageUrl(layer.imagePath);
  const visible = Boolean(layer.enabled && url);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div
        className={cn("relative overflow-hidden rounded-xl border border-border bg-background shadow-sm", className)}
        aria-label={`${label}-Vorschau`}
      >
        {visible ? <div className="absolute inset-0" style={layerCss(layer, url)} /> : null}
        {visible && layer.overlay ? (
          <div className="absolute inset-0 bg-background" style={{ opacity: layer.overlayOpacity / 100 }} />
        ) : null}
        <div className="relative z-10 flex h-full min-h-0">
          {viewport !== "mobile" ? (
            <div className="w-14 shrink-0 border-r border-border/50 bg-sidebar/40 backdrop-blur-sm" aria-hidden />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-2 backdrop-blur-sm">
              <img src="/peptix-logo.png" alt="PEPTIX" className="h-6 w-auto object-contain" />
            </div>
            <div className="flex-1 p-3">
              <Card className="bg-card/95">
                <CardContent className="space-y-2 p-3">
                  <p className="text-xs font-semibold">Lesbarkeit prüfen</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Karten, Logo und Navigation müssen vor dem Artwork klar bleiben.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SiteDesignPreview({ config }: { config: SiteDesignConfig }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1.2fr_0.8fr]">
      <PreviewChrome config={config} viewport="desktop" label="Desktop" className="aspect-video min-h-[12rem]" />
      <PreviewChrome config={config} viewport="tablet" label="Tablet" className="aspect-[4/3] min-h-[12rem]" />
      <PreviewChrome config={config} viewport="mobile" label="Mobile" className="mx-auto aspect-[9/16] w-full max-w-[14rem]" />
    </div>
  );
}
