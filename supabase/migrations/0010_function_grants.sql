-- 0010_function_grants.sql
-- Explicit, documented EXECUTE grants for RPC-callable functions. Postgres
-- grants EXECUTE to PUBLIC by default when a function is created; we revoke
-- that default everywhere and grant back only what each function actually
-- needs, so this file is the single place that answers "who can call what".

-- has_role: read-only role check, safe for any logged-in user (used by the
-- Edge Functions' admin guard, and harmless if a client called it directly).
revoke all on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated;

-- product_is_referenced: read-only existence check, used by the admin UI
-- before offering a hard delete. Admin-only in practice (the surrounding UI
-- is admin-gated) but harmless for any authenticated user to call directly.
revoke all on function public.product_is_referenced(uuid) from public;
grant execute on function public.product_is_referenced(uuid) to authenticated;

-- log_audit: has its own internal anti-forgery guard (see 0007), but we
-- still only expose it to logged-in users / the service role, never anon.
revoke all on function public.log_audit(uuid, text, text, uuid, jsonb, jsonb) from public;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb, jsonb) to authenticated, service_role;

-- set_updated_at / bump_cart_updated_at / *_audit / *_before_write /
-- *_log_price_history / handle_new_user are all trigger functions, never
-- called directly via RPC, so no grants are needed for them.
