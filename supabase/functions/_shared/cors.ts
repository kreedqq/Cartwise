// Shared CORS headers for all Edge Functions. Restrict ALLOWED_ORIGIN in
// production via the ALLOWED_ORIGIN secret (comma-separated list) instead of
// leaving this wide open once you know your GitHub Pages URL.
const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin =
    configuredOrigins.includes("*") || !origin
      ? "*"
      : configuredOrigins.includes(origin)
        ? origin
        : configuredOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...(init.headers ?? {}),
    },
  });
}
