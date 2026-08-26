import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import { SupabaseConfigError } from "@/components/SupabaseConfigError";
import { supabaseConfigProblems } from "@/lib/supabaseClient";
import "@/index.css";

// A broken Supabase config is reported up front instead of letting the app
// start and fail on every single request with an opaque network error.
const root = supabaseConfigProblems ? (
  <SupabaseConfigError problems={supabaseConfigProblems} />
) : (
  <App />
);

createRoot(document.getElementById("root")!).render(<StrictMode>{root}</StrictMode>);
