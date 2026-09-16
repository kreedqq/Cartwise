import { supabase } from "@/lib/supabaseClient";

export interface ExchangeRateResult {
  rate: number | null;
  source: string | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

/** Same append-only table the get-exchange-rate edge function writes to (local fallback only). */
async function fetchLatestRateFromDb(): Promise<ExchangeRateResult | null> {
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate, source, fetched_at")
    .eq("base_currency", "USD")
    .eq("quote_currency", "EUR")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.rate) return null;
  return {
    rate: Number(data.rate),
    source: data.source ?? "exchange_rates",
    fetchedAt: data.fetched_at,
    stale: true,
    error: null,
  };
}

export async function fetchExchangeRate(forceRefresh = false): Promise<ExchangeRateResult> {
  const { data, error } = await supabase.functions.invoke<ExchangeRateResult>("get-exchange-rate", {
    body: {},
    ...(forceRefresh ? { headers: {} } : {}),
  });

  if (error) {
    const fromDb = await fetchLatestRateFromDb();
    if (fromDb) return fromDb;
    return {
      rate: null,
      source: null,
      fetchedAt: null,
      stale: false,
      error: "Wechselkurs-Dienst ist aktuell nicht erreichbar.",
    };
  }

  if (forceRefresh) {
    // The function itself supports ?refresh=true; supabase-js's invoke()
    // doesn't expose query params directly, so we call fetch through the
    // client's functions URL builder instead for a forced refresh.
    return fetchExchangeRateForced();
  }

  const result = data as ExchangeRateResult;
  if (result.rate == null) {
    const fromDb = await fetchLatestRateFromDb();
    if (fromDb) return fromDb;
  }
  return result;
}

async function fetchExchangeRateForced(): Promise<ExchangeRateResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-exchange-rate?refresh=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) {
    const fromDb = await fetchLatestRateFromDb();
    if (fromDb) return fromDb;
    return {
      rate: null,
      source: null,
      fetchedAt: null,
      stale: false,
      error: "Wechselkurs-Dienst ist aktuell nicht erreichbar.",
    };
  }
  const result = (await res.json()) as ExchangeRateResult;
  if (result.rate == null) {
    const fromDb = await fetchLatestRateFromDb();
    if (fromDb) return fromDb;
  }
  return result;
}
