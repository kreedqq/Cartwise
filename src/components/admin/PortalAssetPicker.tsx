import { cn } from "@/lib/utils";
import {
  BUILTIN_PORTAL_ASSETS,
  type BuiltinPortalAssetId,
  isBuiltinPortalAssetId,
} from "@/lib/shop/portalAssets";

export function PortalAssetPicker({
  value,
  onChange,
  label = "Portal auswählen",
}: {
  value: string;
  onChange: (assetId: BuiltinPortalAssetId | "") => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BUILTIN_PORTAL_ASSETS.map((asset) => {
          const selected = value === asset.id;
          return (
            <button
              key={asset.id}
              type="button"
              data-testid={`portal-asset-${asset.id}`}
              onClick={() => onChange(asset.id)}
              className={cn(
                "relative overflow-hidden rounded-lg border p-2 text-left transition-[border-color,box-shadow] duration-200",
                "bg-[#0a0a0f] hover:border-primary/40",
                selected ? "border-primary ring-2 ring-primary/35" : "border-border/60",
              )}
            >
              <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_42%,#14141c,#030305)]">
                <img
                  src={asset.path}
                  alt=""
                  className="max-h-[92%] max-w-[92%] object-contain drop-shadow-[0_0_28px_rgba(255,255,255,0.12)]"
                  loading="lazy"
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
                {asset.colorLabel}
              </p>
            </button>
          );
        })}
      </div>
      {value && !isBuiltinPortalAssetId(value) ? (
        <p className="text-[11px] text-muted-foreground">Custom: {value}</p>
      ) : null}
    </div>
  );
}
