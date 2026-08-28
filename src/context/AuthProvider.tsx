import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { getOwnProfile } from "@/services/profiles";
import { getOwnRoles } from "@/services/roles";
import { getMyCustomerRoleName } from "@/services/customerRoles";
import type { Role, Tables } from "@/types/database";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  roles: Role[];
  isAdmin: boolean;
  customerRoleName: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Tables<"profiles"> | null>(null);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [customerRoleName, setCustomerRoleName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadUserData = React.useCallback(async (userId: string) => {
    try {
      const [profileData, roleData, pricingRoleName] = await Promise.all([
        getOwnProfile(userId),
        getOwnRoles(userId),
        getMyCustomerRoleName().catch(() => null),
      ]);
      setProfile(profileData);
      setRoles(roleData);
      setCustomerRoleName(pricingRoleName);
    } catch (error) {
      console.error("Profil/Rollen konnten nicht geladen werden:", error);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadUserData(newSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setCustomerRoleName(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const refreshProfile = React.useCallback(async () => {
    if (session?.user) {
      await loadUserData(session.user.id);
    }
  }, [session, loadUserData]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    isAdmin: roles.includes("admin"),
    customerRoleName,
    loading,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  return ctx;
}
