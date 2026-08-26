// get-exchange-rate
//
// Returns the current USD -> EUR exchange rate, with server-side caching and
// a documented fallback strategy (see docs/KONZEPT.md §6):
//   1. If a cached rate in `exchange_rates` is newer than
//      EXCHANGE_RATE_CACHE_MINUTES, return it unchanged (no external call).
//   2. Otherwise fetch a fresh rate from the Frankfurter API (ECB reference
//      rates, no API key required - see docs/KONZEPT.md assumption A2) and
//      store it as a new row.
//   3. If the external call fails, fall back to the most recent cached row
//      (however old) and mark the response `stale: true`.
//   4. If there is no cached row at all AND the external call fails, return
//      `rate: null` - the frontend must never invent a exchange rate.
//
// No secret is required for the current provider, but the fetch still runs
// server-side (rather than directly from the browser) so caching is
// centralized and a future key-based provider can be swapped in here without
// touching the frontend at all.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CACHE_MINUTES = Number(Deno.env.get("EXCHANGE_RATE_CACHE_MINUTES") ?? "60");
const SOURCE_NAME = "frankfurter.dev (ECB)";
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR";

interface ExchangeRateRow {
  id: string;
  rate: number;
  source: string;
  fetched_at: string;
}

interface ExchangeRateResponse {
  rate: number | null;
  source: string | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 }, origin);
  }

  const forceRefresh = new URL(req.url).searchParams.get("refresh") === "true";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    // service-role: this function only ever INSERTs into an append-only,
    // publicly-readable table, so elevated access here is safe and
    // necessary because RLS intentionally has no client-side INSERT policy.
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const latest = await getLatestCachedRate(supabase);

    if (!forceRefresh && latest && isFresh(latest.fetched_at)) {
      return jsonResponse(toResponse(latest, false), { status: 200 }, origin);
    }

    try {
      const fresh = await fetchFromProvider();
      const inserted = await storeRate(supabase, fresh);
      return jsonResponse(toResponse(inserted, false), { status: 200 }, origin);
    } catch (fetchError) {
      console.error("Exchange rate provider fetch failed:", fetchError);

      if (latest) {
        return jsonResponse(toResponse(latest, true), { status: 200 }, origin);
      }

      const response: ExchangeRateResponse = {
        rate: null,
        source: null,
        fetchedAt: null,
        stale: false,
        error: "Kein Wechselkurs verfügbar. Der Dienst ist aktuell nicht erreichbar und es liegt kein zwischengespeicherter Kurs vor.",
      };
      return jsonResponse(response, { status: 200 }, origin);
    }
  } catch (error) {
    console.error("get-exchange-rate failed:", error);
    return jsonResponse(
      { rate: null, source: null, fetchedAt: null, stale: false, error: "Interner Fehler beim Abrufen des Wechselkurses." },
      { status: 500 },
      origin,
    );
  }
});

async function getLatestCachedRate(
  supabase: ReturnType<typeof createClient>,
): Promise<ExchangeRateRow | null> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("id, rate, source, fetched_at")
    .eq("base_currency", "USD")
    .eq("quote_currency", "EUR")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ExchangeRateRow | null;
}

function isFresh(fetchedAt: string): boolean {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs < CACHE_MINUTES * 60 * 1000;
}

async function fetchFromProvider(): Promise<{ rate: number; source: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(FRANKFURTER_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Frankfurter API antwortete mit Status ${res.status}`);
    }
    const body = (await res.json()) as { rates?: { EUR?: number } };
    const rate = body.rates?.EUR;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("Frankfurter API lieferte keinen gültigen EUR-Kurs.");
    }
    return { rate, source: SOURCE_NAME };
  } finally {
    clearTimeout(timeout);
  }
}

async function storeRate(
  supabase: ReturnType<typeof createClient>,
  fresh: { rate: number; source: string },
): Promise<ExchangeRateRow> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .insert({
      base_currency: "USD",
      quote_currency: "EUR",
      rate: fresh.rate,
      source: fresh.source,
    })
    .select("id, rate, source, fetched_at")
    .single();

  if (error) throw error;
  return data as ExchangeRateRow;
}

function toResponse(row: ExchangeRateRow, stale: boolean): ExchangeRateResponse {
  return {
    rate: row.rate,
    source: row.source,
    fetchedAt: row.fetched_at,
    stale,
    error: null,
  };
}
