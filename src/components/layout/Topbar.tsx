import { useNavigate } from "react-router-dom";
import { LogOut, Moon, ShoppingCart, Sun, UserCircle, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthProvider";
import { useTheme } from "@/hooks/useTheme";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { signOut } from "@/services/auth";
import { toast } from "@/components/ui/toaster";
import { APP_NAME } from "@/lib/constants";

export function Topbar() {
  const { profile, user } = useAuth();
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/login");
    } catch {
      toast.error("Abmelden fehlgeschlagen. Bitte versuche es erneut.");
    }
  }

  const initials = (profile?.display_name ?? user?.email ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShoppingCart className="h-4.5 w-4.5" />
        </div>
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="flex items-center gap-2">
        {!online && (
          <span className="hidden items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning sm:inline-flex">
            <WifiOff className="h-3.5 w-3.5" />
            Offline
          </span>
        )}

        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Farbschema umschalten">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials || <UserCircle className="h-4 w-4" />}
              </span>
              <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                {profile?.display_name ?? user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <UserCircle /> Profil &amp; Einstellungen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
