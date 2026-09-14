import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KIT_REQUEST_CREATE_LABEL } from "@/lib/kitRequests";
import { AREA_ACTION_NAV } from "@/lib/shop/areaLayout";
import { cn } from "@/lib/utils";

export function KitAreaActionNav({
  section,
  onSection,
  onCreate,
  canUseKitRequests = true,
  className,
}: {
  section: "catalog" | "kits";
  onSection: (section: "catalog" | "kits") => void;
  onCreate: () => void;
  canUseKitRequests?: boolean;
  className?: string;
}) {
  return (
    <nav className={cn(AREA_ACTION_NAV, className)} aria-label="Group Buy Aktionen">
      <Button
        className="min-h-11"
        variant={section === "catalog" ? "default" : "outline"}
        onClick={() => onSection("catalog")}
      >
        Produkte
      </Button>
      {canUseKitRequests ? (
        <>
          <Button
            className="min-h-11"
            variant={section === "kits" ? "default" : "outline"}
            onClick={() => onSection("kits")}
          >
            Kit Gesuche
          </Button>
          <Button className="min-h-11" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {KIT_REQUEST_CREATE_LABEL}
          </Button>
        </>
      ) : null}
    </nav>
  );
}

export function KitRequestHint({ className }: { className?: string }) {
  return (
    <p className={cn("max-w-2xl text-sm leading-relaxed text-muted-foreground", className)}>
      Teile ein Kit mit anderen Kunden und bezahle nur deinen Anteil.
    </p>
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
