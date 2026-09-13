-- 0071_payment_method_settings.sql
-- Admin-toggled checkout payment methods via existing app_settings.
-- Additive. Does not rewrite historical orders or payment_method snapshots.

insert into public.app_settings (key, value_bool)
values
  ('payment_crypto_enabled', true),
  ('payment_paypal_enabled', true),
  ('payment_bank_transfer_enabled', true)
on conflict (key) do nothing;

create or replace function public.payment_method_enabled(_method text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.value_bool
      from public.app_settings s
      where s.key = case _method
        when 'crypto' then 'payment_crypto_enabled'
        when 'paypal' then 'payment_paypal_enabled'
        when 'bank_transfer' then 'payment_bank_transfer_enabled'
        else null
      end
    ),
    false
  );
$$;

revoke all on function public.payment_method_enabled(text) from public, anon, authenticated;

create or replace function public.get_site_access_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _maintenance boolean;
  _discounts   boolean;
  _admin       boolean;
begin
  _maintenance := public.maintenance_mode_enabled();
  _discounts   := public.quantity_discounts_enabled();
  _admin       := public.caller_is_admin();

  return jsonb_build_object(
    'maintenance_mode', _maintenance,
    'quantity_discounts_enabled', _discounts,
    'caller_is_admin', _admin,
    'site_access_allowed', (not _maintenance) or _admin,
    'payment_crypto_enabled', public.payment_method_enabled('crypto'),
    'payment_paypal_enabled', public.payment_method_enabled('paypal'),
    'payment_bank_transfer_enabled', public.payment_method_enabled('bank_transfer')
  );
end;
$$;

revoke all on function public.get_site_access_state() from public;
grant execute on function public.get_site_access_state() to anon, authenticated;

create or replace function public.admin_set_app_setting(_key text, _value boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;

  if _key is null or _key not in (
    'maintenance_mode',
    'quantity_discounts_enabled',
    'payment_crypto_enabled',
    'payment_paypal_enabled',
    'payment_bank_transfer_enabled'
  ) then
    raise exception 'Unbekannte Einstellung.' using errcode = 'P0001';
  end if;

  update public.app_settings
  set value_bool = _value,
      updated_at = now(),
      updated_by = auth.uid()
  where key = _key;

  if not found then
    raise exception 'Einstellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  perform public.log_audit(
    auth.uid(),
    'app_settings.update',
    'app_settings',
    null,
    null,
    jsonb_build_object('key', _key, 'value', _value)
  );

  return public.get_site_access_state();
end;
$$;

revoke all on function public.admin_set_app_setting(text, boolean) from public, anon;
grant execute on function public.admin_set_app_setting(text, boolean) to authenticated;

create or replace function public.assert_order_payment_method_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_method is null then
    raise exception 'Bitte wählen Sie eine Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  if new.payment_method not in ('crypto', 'bank_transfer', 'paypal') then
    raise exception 'Bitte wählen Sie eine gültige Zahlungsmethode aus.' using errcode = 'P0001';
  end if;

  if not public.payment_method_enabled(new.payment_method) then
    raise exception 'Diese Zahlungsmethode ist derzeit nicht verfügbar.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.assert_order_payment_method_enabled() from public, anon, authenticated;

drop trigger if exists orders_assert_payment_method_enabled on public.orders;
create trigger orders_assert_payment_method_enabled
  before insert on public.orders
  for each row
  execute function public.assert_order_payment_method_enabled();
