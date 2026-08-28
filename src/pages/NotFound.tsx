import { Link } from "react-router-dom";
import { CompassIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <CompassIcon className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Button asChild>
        <Link to="/dashboard">Zurück zur Übersicht</Link>
      </Button>
    </div>
  );
}
