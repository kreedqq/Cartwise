import type { ReactNode } from "react";
import { Layers, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KIT_REQUEST_CREATE_LABEL } from "@/lib/kitRequests";
import { cn } from "@/lib/utils";

export function KitRequestIntro({
  action,
  className,
}: {
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 sm:px-3.5",
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Layers className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-tight">Kit gemeinsam kaufen</h2>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Teile ein Kit mit anderen Kunden und bezahle nur für deinen Anteil.
        </p>
      </div>
      {action ? <div className="hidden shrink-0 sm:block">{action}</div> : null}
    </div>
  );
}

export function CreateKitRequestButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button className={cn("min-h-11 w-full sm:w-auto", className)} onClick={onClick}>
      <Plus className="h-4 w-4" />
      {KIT_REQUEST_CREATE_LABEL}
    </Button>
  );
}
