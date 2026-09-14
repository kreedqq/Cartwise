-- 0090_kit_request_role_permission.sql
-- Production follow-up after 0089 history stub (select 1). Idempotent verification
-- that kit role permission body is present. Safe on fresh installs after 0089.

do $guard$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_roles'
      and column_name = 'can_use_kit_requests'
  ) then
    raise exception '0090 incomplete: can_use_kit_requests missing';
  end if;

  if not exists (
    select 1 from public.customer_roles
    where upper(trim(name)) = 'GROUP BUY' and can_use_kit_requests
  ) then
    raise exception '0090 incomplete: Group Buy not enabled';
  end if;

  if exists (
    select 1 from public.customer_roles
    where is_default and can_use_kit_requests
  ) then
    raise exception '0090 incomplete: default role unexpectedly enabled';
  end if;

  if not (
    select position('assert_user_can_use_kit_requests' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_kit_request'
    limit 1
  ) then
    raise exception '0090 incomplete: create_kit_request not patched';
  end if;

  if not (
    select position('user_can_use_kit_requests' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_open_kit_requests'
    limit 1
  ) then
    raise exception '0090 incomplete: list_open_kit_requests not patched';
  end if;
end;
$guard$;
