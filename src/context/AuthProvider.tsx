import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabaseClient";
import { clearUserScopedQueries } from "@/lib/userSessionCache";
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
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Tables<"profiles"> | null>(null);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [customerRoleName, setCustomerRoleName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const prevUserIdRef = React.useRef<string | null>(null);

  const resetUserState = React.useCallback(() => {
    setProfile(null);
    setRoles([]);
    setCustomerRoleName(null);
  }, []);

  const handleAuthUserChange = React.useCallback(
    (nextUserId: string | null) => {
      if (prevUserIdRef.current === nextUserId) return;
      clearUserScopedQueries(queryClient);
      prevUserIdRef.current = nextUserId;
    },
    [queryClient],
  );

  const loadUserData = React.useCallback(
    async (userId: string) => {
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
        // Keep the auth session. A missing username is handled by
        // RequireUsernameDialog; a profile/role fetch error must not bounce to /login.
        console.error("Profil/Rollen konnten nicht geladen werden:", error);
      }
    },
    [],
  );

  React.useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !user) {
        setSession(null);
        resetUserState();
        handleAuthUserChange(null);
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
      handleAuthUserChange(user.id);
      await loadUserData(user.id);
      if (mounted) setLoading(false);
    }

    void bootstrapAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      handleAuthUserChange(newSession?.user?.id ?? null);
      if (newSession?.user) {
        void loadUserData(newSession.user.id);
      } else {
        resetUserState();
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [handleAuthUserChange, loadUserData, resetUserState]);

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
