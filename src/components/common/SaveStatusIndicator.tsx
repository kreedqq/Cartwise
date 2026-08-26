import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveStatusIndicator({ status, className }: { status: SaveStatus; className?: string }) {
  if (status === "idle") return null;

  const config = {
    saving: { icon: Loader2, label: "Speichert …", cls: "text-muted-foreground", spin: true },
    saved: { icon: Check, label: "Gespeichert", cls: "text-success", spin: false },
    error: { icon: AlertCircle, label: "Fehler beim Speichern", cls: "text-destructive", spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", config.cls, className)}>
      <Icon className={cn("h-3.5 w-3.5", config.spin && "animate-spin")} />
      {config.label}
    </span>
  );
}
