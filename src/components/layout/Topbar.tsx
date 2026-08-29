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
import { useCarts } from "@/hooks/useCarts";
import { useCartSummaries } from "@/hooks/useCartSummaries";
import { signOut } from "@/services/auth";
import { pickActiveOpenCart } from "@/services/carts";
import { clearUserScopedQueries } from "@/lib/userSessionCache";
import { toast } from "@/components/ui/toaster";
import { BrandMark } from "@/components/layout/BrandMark";
import { useNavShell } from "@/context/NavShellProvider";
import { useQueryClient } from "@tanstack/react-query";

export function Topbar() {
  const { profile, user } = useAuth();
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sidebarCollapsed } = useNavShell();
  const cartsQuery = useCarts();
  const summariesQuery = useCartSummaries();

  const activeCart = pickActiveOpenCart(cartsQuery.data, user?.id);
  const cartCount = activeCart ? (summariesQuery.data?.get(activeCart.id)?.item_count ?? 0) : 0;

  async function handleSignOut() {
    try {
      await signOut();
      clearUserScopedQueries(queryClient);
      navigate("/login");
    } catch (error) {
      console.error("Abmelden fehlgeschlagen:", error);
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
    <header className="sticky top-0 z-30 flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 py-2 backdrop-blur-md sm:px-6 lg:min-h-24">
      <div className="min-w-0 flex-1 lg:hidden">
        <BrandMark />
      </div>

      <div className={sidebarCollapsed ? "hidden min-w-0 lg:block lg:flex-1" : "hidden"}>
        <BrandMark />
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="flex items-center gap-2">
        {!online && (
          <span className="hidden items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning sm:inline-flex">
            <WifiOff className="h-3.5 w-3.5" />
            Offline
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={cartCount > 0 ? `Aktiver Warenkorb, ${cartCount} Artikel` : "Aktiver Warenkorb"}
          onClick={() => navigate(activeCart ? `/carts/${activeCart.id}` : "/dashboard")}
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Button>

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
