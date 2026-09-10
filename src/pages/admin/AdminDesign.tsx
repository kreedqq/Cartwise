import * as React from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSection } from "@/components/admin/AdminSection";
import { SiteDesignPreview } from "@/components/design/SitePreview";
import { ErrorState } from "@/components/common/ErrorState";
import { ImageDropzone } from "@/components/media/ImageDropzone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { useSaveSiteDesign, useSiteDesign } from "@/hooks/useTrustExperience";
import {
  EMPTY_SITE_DESIGN,
  parseSiteDesignConfig,
  type SiteDesignConfig,
  type SiteDesignLayer,
} from "@/lib/siteDesign";
import { deleteSiteDesignImage, siteDesignImageUrl, uploadSiteDesignImage } from "@/services/siteDesign";

type Device = "desktop" | "tablet" | "mobile";

function RangeField({
  id,
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} ({value}
        {suffix})
      </Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function AdminDesignPage() {
  const query = useSiteDesign();
  const saveMutation = useSaveSiteDesign();
  const [draftEnabled, setDraftEnabled] = React.useState<boolean | null>(null);
  const [draftConfig, setDraftConfig] = React.useState<SiteDesignConfig | null>(null);
  const [device, setDevice] = React.useState<Device>("desktop");
  const [pendingFiles, setPendingFiles] = React.useState<Partial<Record<Device, File>>>({});
  const [pendingPreviews, setPendingPreviews] = React.useState<Partial<Record<Device, string>>>({});

  const enabled = draftEnabled ?? query.data?.enabled ?? false;
  const config = draftConfig ?? (query.data ? parseSiteDesignConfig(query.data.config) : EMPTY_SITE_DESIGN);

  function setEnabled(value: boolean) {
    setDraftEnabled(value);
  }

  function setConfig(updater: SiteDesignConfig | ((current: SiteDesignConfig) => SiteDesignConfig)) {
    setDraftConfig((current) => {
      const base = current ?? parseSiteDesignConfig(query.data?.config);
      return typeof updater === "function" ? updater(base) : updater;
    });
  }

  const layer = config[device];

  function patchLayer(partial: Partial<SiteDesignLayer>) {
    setConfig((current) => ({ ...current, [device]: { ...current[device], ...partial } }));
  }

  async function handleSave() {
    try {
      const original = parseSiteDesignConfig(query.data?.config);
      const next: SiteDesignConfig = structuredClone(config);
      for (const key of ["desktop", "tablet", "mobile"] as Device[]) {
        const file = pendingFiles[key];
        if (file) {
          const path = await uploadSiteDesignImage(key, file);
          const previous = original[key].imagePath;
          next[key] = { ...next[key], imagePath: path };
          if (previous && previous !== path) {
            await deleteSiteDesignImage(previous).catch(() => undefined);
          }
        } else if (!next[key].imagePath && original[key].imagePath) {
          await deleteSiteDesignImage(original[key].imagePath).catch(() => undefined);
        }
      }
      await saveMutation.mutateAsync({ enabled, config: next });
      setConfig(next);
      setPendingFiles({});
      Object.values(pendingPreviews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      setPendingPreviews({});
      toast.success("Design gespeichert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Design konnte nicht gespeichert werden.");
    }
  }

  const liveConfig = React.useMemo(() => {
    const clone = structuredClone(config);
    (["desktop", "tablet", "mobile"] as Device[]).forEach((key) => {
      if (pendingPreviews[key]) clone[key].imagePath = pendingPreviews[key] ?? clone[key].imagePath;
    });
    return clone;
  }, [config, pendingPreviews]);

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    return <ErrorState message="Design-Einstellungen konnten nicht geladen werden." onRetry={() => query.refetch()} />;
  }

  const previewUrl = pendingPreviews[device] ?? siteDesignImageUrl(layer.imagePath);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Design"
        description="Website-Hintergründe zentral steuern. Der Maintenance-Screen bleibt unverändert."
        actions={
          <Button type="button" loading={saveMutation.isPending} onClick={() => void handleSave()}>
            Speichern
          </Button>
        }
      />

      <AdminSection title="Allgemein" padded>
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Hintergrund aktiv</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Hintergrund aktiv" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={config.inheritTabletFromDesktop && config.inheritMobileFromDesktop}
              onCheckedChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  inheritTabletFromDesktop: value === true,
                  inheritMobileFromDesktop: value === true,
                }))
              }
            />
            Ein Bild für alle Geräte verwenden
          </label>
        </div>
      </AdminSection>

      <AdminSection title="Hintergrund" description="Eigenes Artwork je Gerät, sonst Desktop als Fallback." padded>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["desktop", "tablet", "mobile"] as Device[]).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={device === item ? "default" : "outline"}
              onClick={() => setDevice(item)}
            >
              {item === "desktop" ? "Desktop" : item === "tablet" ? "Tablet" : "Mobile"}
            </Button>
          ))}
        </div>
        {device !== "desktop" ? (
          <label className="mb-4 flex items-center gap-2 text-sm">
            <Checkbox
              checked={device === "tablet" ? config.inheritTabletFromDesktop : config.inheritMobileFromDesktop}
              onCheckedChange={(value) =>
                setConfig((current) =>
                  device === "tablet"
                    ? { ...current, inheritTabletFromDesktop: value === true }
                    : { ...current, inheritMobileFromDesktop: value === true },
                )
              }
            />
            Desktop-Bild als Fallback nutzen
          </label>
        ) : null}
        <label className="mb-4 flex items-center justify-between gap-3 text-sm">
          <span>Dieses Gerät aktiv</span>
          <Switch
            checked={layer.enabled}
            onCheckedChange={(value) => patchLayer({ enabled: value })}
            aria-label="Gerätehintergrund aktiv"
          />
        </label>
        <ImageDropzone
          previewUrl={previewUrl}
          objectPosition={`${layer.focalX}% ${layer.focalY}%`}
          onFile={(file) => {
            const previous = pendingPreviews[device];
            if (previous) URL.revokeObjectURL(previous);
            setPendingFiles((current) => ({ ...current, [device]: file }));
            setPendingPreviews((current) => ({ ...current, [device]: URL.createObjectURL(file) }));
          }}
          onRemove={() => {
            const previous = pendingPreviews[device];
            if (previous) URL.revokeObjectURL(previous);
            setPendingFiles((current) => ({ ...current, [device]: undefined }));
            setPendingPreviews((current) => ({ ...current, [device]: undefined }));
            patchLayer({ imagePath: null });
          }}
        />
      </AdminSection>

      <AdminSection title="Darstellung" padded>
        <div className="grid gap-4 md:grid-cols-2">
          <RangeField
            id="focal-x"
            label="Fokus X"
            value={layer.focalX}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => patchLayer({ focalX: value })}
          />
          <RangeField
            id="focal-y"
            label="Fokus Y"
            value={layer.focalY}
            min={0}
            max={100}
            suffix="%"
            onChange={(value) => patchLayer({ focalY: value })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="bg-size">Skalierung</Label>
            <select
              id="bg-size"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={layer.size}
              onChange={(event) => patchLayer({ size: event.target.value === "contain" ? "contain" : "cover" })}
            >
              <option value="cover">Ausfüllen (cover)</option>
              <option value="contain">Einpassen (contain)</option>
            </select>
          </div>
          <RangeField id="scale" label="Größe" value={layer.scale} min={80} max={140} suffix="%" onChange={(value) => patchLayer({ scale: value })} />
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <Checkbox checked={layer.overlay} onCheckedChange={(value) => patchLayer({ overlay: value === true })} />
            Overlay für Lesbarkeit
          </label>
          <RangeField
            id="overlay"
            label="Overlay-Stärke"
            value={layer.overlayOpacity}
            min={0}
            max={85}
            suffix="%"
            onChange={(value) => patchLayer({ overlayOpacity: value })}
          />
          <RangeField
            id="brightness"
            label="Helligkeit"
            value={layer.brightness}
            min={40}
            max={120}
            suffix="%"
            onChange={(value) => patchLayer({ brightness: value })}
          />
          <RangeField
            id="contrast"
            label="Kontrast"
            value={layer.contrast}
            min={70}
            max={130}
            suffix="%"
            onChange={(value) => patchLayer({ contrast: value })}
          />
          <RangeField
            id="saturation"
            label="Sättigung"
            value={layer.saturation}
            min={0}
            max={140}
            suffix="%"
            onChange={(value) => patchLayer({ saturation: value })}
          />
          <RangeField id="blur" label="Blur" value={layer.blur} min={0} max={16} suffix="px" onChange={(value) => patchLayer({ blur: value })} />
          <RangeField
            id="opacity"
            label="Transparenz"
            value={layer.opacity}
            min={20}
            max={100}
            suffix="%"
            onChange={(value) => patchLayer({ opacity: value })}
          />
          <div className="space-y-1.5">
            <Label htmlFor="attachment">Verhalten</Label>
            <select
              id="attachment"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={layer.attachment}
              onChange={(event) => patchLayer({ attachment: event.target.value === "fixed" ? "fixed" : "scroll" })}
            >
              <option value="scroll">Mitscrollen</option>
              <option value="fixed">Fixiert</option>
            </select>
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Vorschau" padded>
        <SiteDesignPreview config={liveConfig} />
        <p className="mt-3 text-xs text-muted-foreground">
          Maintenance bleibt eigenständig. Ohne aktives Bild gilt das bestehende PEPTIX-Design.
        </p>
      </AdminSection>
    </div>
  );
}
