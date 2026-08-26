import "@testing-library/jest-dom/vitest";

// Provide minimal env vars so importing src/lib/supabaseClient.ts in tests
// (transitively, via components) doesn't spam console.error.
if (!import.meta.env.VITE_SUPABASE_URL) {
  // @ts-expect-error - test-only override of readonly import.meta.env
  import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  // @ts-expect-error - test-only override of readonly import.meta.env
  import.meta.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
}
