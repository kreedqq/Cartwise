import { supabase } from "@/lib/supabaseClient";

export interface ExchangeRateResult {
  rate: number | null;
  source: string | null;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
}

export async function fetchExchangeRate(forceRefresh = false): Promise<ExchangeRateResult> {
  const { data, error } = await supabase.functions.invoke<ExchangeRateResult>("get-exchange-rate", {
    body: {},
    ...(forceRefresh ? { headers: {} } : {}),
  });

  if (error) {
    // Edge function unreachable entirely (not the same as a handled provider
    // failure, which the function itself reports with rate: null).
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

  return data as ExchangeRateResult;
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
    return {
      rate: null,
      source: null,
      fetchedAt: null,
      stale: false,
      error: "Wechselkurs-Dienst ist aktuell nicht erreichbar.",
    };
  }
  return (await res.json()) as ExchangeRateResult;
}
