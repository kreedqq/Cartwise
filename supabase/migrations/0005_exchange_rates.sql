-- 0005_exchange_rates.sql
-- Append-only log of fetched exchange rates. Doubles as cache + fallback
-- source for the get-exchange-rate Edge Function (see docs/KONZEPT.md §6).

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'USD',
  quote_currency text not null default 'EUR',
  rate numeric(12, 6) not null check (rate > 0),
  source text not null,
  fetched_at timestamptz not null default now()
);

comment on table public.exchange_rates is
  'Append-only history of fetched USD->EUR rates. Never updated, only inserted (by the get-exchange-rate Edge Function).';

create index exchange_rates_lookup_idx
  on public.exchange_rates (base_currency, quote_currency, fetched_at desc);

alter table public.exchange_rates enable row level security;

-- Everyone logged in may read rates (no secret involved); only the
-- service-role (Edge Function) may insert. No update/delete policy exists.
create policy "exchange_rates_select_authenticated"
  on public.exchange_rates for select
  to authenticated
  using (true);
