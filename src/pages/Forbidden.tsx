import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-semibold">Keine Berechtigung</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Du hast keine Berechtigung, diese Seite zu sehen. Falls du glaubst, dass dies ein Fehler ist, wende dich an
        einen Administrator.
      </p>
      <Button asChild>
        <Link to="/dashboard">Zurück zum Dashboard</Link>
      </Button>
    </div>
  );
}
