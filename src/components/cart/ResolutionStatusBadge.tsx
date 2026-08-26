import { AlertCircle, CheckCircle2, HelpCircle, PauseCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ResolutionStatus } from "@/types/database";

export function ResolutionStatusBadge({ status }: { status: ResolutionStatus }) {
  switch (status) {
    case "resolved":
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" /> Gefunden
        </Badge>
      );
    case "not_found":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3" /> Unbekannter Code
        </Badge>
      );
    case "inactive":
      return (
        <Badge variant="warning">
          <PauseCircle className="h-3 w-3" /> Deaktiviert
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <HelpCircle className="h-3 w-3" /> Ausstehend
        </Badge>
      );
  }
}
