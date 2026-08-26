import { createClient } from "@supabase/supabase-js";

import { readSupabaseConfig } from "@/lib/supabaseConfig";
import type { Database } from "@/types/database";

const config = readSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

/**
 * The concrete configuration problems, or null when the config is usable.
 * main.tsx renders a config screen instead of the app when this is set, so a
 * broken deployment reports the actual cause up front rather than failing
 * later with an opaque network error on every request.
 */
export const supabaseConfigProblems: string[] | null = config.ok ? null : config.problems;

if (!config.ok) {
  console.error(
    ["Supabase ist nicht korrekt konfiguriert (siehe .env.example):", ...config.problems].join("\n  - "),
  );
}

// Project URL + anon/publishable key are PUBLIC values - safe to ship in the
// client bundle. RLS enforces all access control server-side (see
// docs/SECURITY.md). Never put the service-role key here or anywhere in src/.
export const supabase = createClient<Database>(config.ok ? config.url : "", config.ok ? config.anonKey : "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
