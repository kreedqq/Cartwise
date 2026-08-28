-- 0015_table_grants.sql
-- Root cause of "Produkt konnte nicht gespeichert werden" (and, on closer
-- inspection, of most other reads/writes in the app): Postgres requires an
-- explicit table-level GRANT in addition to a passing RLS policy. A normal
-- Supabase project ships default privileges that grant ALL on every public
-- table to anon/authenticated/service_role automatically, so every prior
-- migration in this project (correctly) relied on RLS alone and never
-- issued its own table GRANTs. On this project instance those default
-- privileges were never present, so every operation failed with
-- 42501 "permission denied for table x" *before* any RLS policy was even
-- evaluated - independent of whether that policy would have allowed it.
--
-- Verified directly against the linked database (supabase db query, with
-- `set local role authenticated` + the real admin's JWT claims):
--   select count(*) from public.products;                       -> 42501
--   insert into public.products (...) values (...);              -> 42501
-- and `information_schema.role_table_grants` showed authenticated/
-- service_role had only REFERENCES/TRIGGER/TRUNCATE (or nothing) on nearly
-- every table - never SELECT/INSERT/UPDATE/DELETE.
--
-- RLS remains the actual authorization boundary (nothing here loosens or
-- replaces any policy); these GRANTs only unlock the capability that the
-- already-existing policies gate. Every grant below matches the write
-- surface a role already has under RLS - it does not add new capability
-- beyond what the policies (see 0001-0014) already intend.

-- ---------------------------------------------------------------------------
-- authenticated: matches each table's existing RLS policies exactly.
-- ---------------------------------------------------------------------------

-- products: select (active-or-admin), insert/update/delete (admin only via
-- with-check) - see 0003/0014 policies.
grant select, insert, update, delete on public.products to authenticated;

-- product_price_history: admin-only select. Rows are written exclusively by
-- the SECURITY DEFINER products_log_price_history trigger (owned by the
-- table owner), so no INSERT grant is needed here.
grant select on public.product_price_history to authenticated;

-- carts / cart_items: full CRUD for the owning user (or admin select) - see
-- 0004 policies.
grant select, insert, update, delete on public.carts to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;

-- exchange_rates: read-only for any logged-in user; inserts only ever come
-- from the get-exchange-rate Edge Function via service_role - see 0005.
grant select on public.exchange_rates to authenticated;

-- pdf_imports / pdf_import_rows: admin-only "for all" policy (0006). The
-- apply_pdf_import RPC (SECURITY INVOKER) inserts/updates these directly as
-- the calling admin, so it needs the same grants a direct table write would.
grant select, insert, update, delete on public.pdf_imports to authenticated;
grant select, insert, update, delete on public.pdf_import_rows to authenticated;

-- audit_logs: admin-only select (0007). Rows are written exclusively via the
-- SECURITY DEFINER log_audit() function, so no INSERT grant is needed here.
grant select on public.audit_logs to authenticated;

-- profiles: users may read their own or (as admin) any profile, and update
-- their own display name (src/services/profiles.ts updateDisplayName) -
-- see 0002 policies. INSERT happens only via the SECURITY DEFINER
-- handle_new_user trigger on auth.users, never directly by a client.
grant select, update on public.profiles to authenticated;

-- user_roles: read-only for clients (own row or admin) - see 0002. Writes
-- happen exclusively via the set-user-role Edge Function (service_role) or
-- the documented first-admin SQL bootstrap; no RLS write policy exists, so
-- no INSERT/UPDATE/DELETE grant is issued here.
grant select on public.user_roles to authenticated;

-- ---------------------------------------------------------------------------
-- service_role: bypasses RLS (BYPASSRLS) but still needs table grants for
-- the direct table access performed by the Edge Functions in
-- supabase/functions/*, and as a safety net for any future server-side
-- tooling that needs direct table access.
-- ---------------------------------------------------------------------------

-- get-exchange-rate reads + inserts exchange_rates directly (supabase/
-- functions/get-exchange-rate/index.ts).
grant select, insert, update, delete on public.exchange_rates to service_role;

-- set-user-role upserts/deletes user_roles and calls log_audit directly
-- (supabase/functions/set-user-role/index.ts).
grant select, insert, update, delete on public.user_roles to service_role;
grant select, insert, update, delete on public.audit_logs to service_role;

-- Broad safety net for the remaining tables so a future server-side script
-- or Edge Function doesn't silently rediscover this exact bug.
grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.product_price_history to service_role;
grant select, insert, update, delete on public.carts to service_role;
grant select, insert, update, delete on public.cart_items to service_role;
grant select, insert, update, delete on public.pdf_imports to service_role;
grant select, insert, update, delete on public.pdf_import_rows to service_role;
grant select, update on public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Make this the default from now on: without this, any brand-new table
-- created by a later migration (run by the same `postgres` role the CLI
-- connects as) would silently repeat this exact bug until someone
-- remembers to grant it explicitly again.
-- ---------------------------------------------------------------------------

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
