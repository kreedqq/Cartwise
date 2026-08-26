import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly and early rather than letting every query fail with a
  // confusing network error later.
  console.error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sind nicht gesetzt. Siehe .env.example.",
  );
}

// Both values are the PUBLIC anon key + project URL - safe to ship in the
// client bundle. RLS enforces all access control server-side (see
// docs/SECURITY.md). Never put the service-role key here or anywhere in src/.
export const supabase = createClient<Database>(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
