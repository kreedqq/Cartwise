import { AlertTriangle, RotateCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isOnline } from "@/lib/errors";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const offline = !isOnline();
  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-destructive">
          {offline ? "Keine Internetverbindung" : "Etwas ist schiefgelaufen"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {message ?? "Bitte versuche es erneut. Falls das Problem bestehen bleibt, lade die Seite neu."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Erneut versuchen
        </Button>
      )}
    </div>
  );
}
