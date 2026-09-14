/**
 * Local QA seed — catalog, roles, area products.
 * Never run against production. Applied only by scripts/qa/seed-local-qa.mjs
 * after the production-URL abort guard.
 */

-- Roles
insert into public.customer_roles (name, markup_percent, is_active, is_default, can_use_kit_requests)
select 'NEU', 25, true, false, false
where not exists (
  select 1 from public.customer_roles where upper(trim(name)) = 'NEU'
);

update public.customer_roles
set can_use_kit_requests = true
where upper(trim(name)) = 'GROUP BUY';

update public.customer_roles
set can_use_kit_requests = false
where upper(trim(name)) in ('NEU', 'KUNDE', 'STAMMKUNDE');

-- NEU may reach group_buy RPCs so kit permission fail-closed is testable
insert into public.shop_area_role_access (shop_area_key, role_id)
select a.key, r.id
from public.shop_areas a
cross join public.customer_roles r
where a.key in ('shop', 'group_buy_1')
  and upper(trim(r.name)) = 'NEU'
on conflict do nothing;

insert into public.shop_area_role_access (shop_area_key, role_id)
select 'shop', r.id
from public.customer_roles r
where upper(trim(r.name)) in ('KUNDE', 'STAMMKUNDE')
on conflict do nothing;

-- QA products (idempotent by code)
insert into public.products (
  code, name, dosage_vial, description, category,
  price_usd, bulk_price_usd, bulk_price_min_quantity, is_active
)
values
  ('QA-PEP-001', 'QA Peptide Alpha', '10 mg / Vial', 'Local QA injectable peptide', 'Peptides', 60.0000, 55.0000, 10, true),
  ('QA-OIL-001', 'QA Injectable Oil', '10 ml', 'Local QA injectable oil', 'Injectable Oils', 16.0000, null, null, true),
  ('QA-ORAL-001', 'QA Oral Capsule', '250 mcg', 'Local QA oral', 'Orals', 22.0000, null, null, true),
  ('QA-WATER-001', 'QA Reconstitution Water', '10 ml', 'Local QA water', 'Reconstitution Water', 5.0000, null, null, true),
  ('QA-KIT-001', 'QA Kit Peptide', '5 mg / Vial', 'Local QA kit-capable peptide', 'Peptides', 40.0000, 36.0000, 10, true)
on conflict (code) do update set
  name = excluded.name,
  dosage_vial = excluded.dosage_vial,
  description = excluded.description,
  category = excluded.category,
  price_usd = excluded.price_usd,
  bulk_price_usd = excluded.bulk_price_usd,
  bulk_price_min_quantity = excluded.bulk_price_min_quantity,
  is_active = true;

-- Area visibility for shop + group_buy_1 (vendor_code required)
insert into public.shop_area_products (
  shop_area_key, product_id, vendor_code, vendor_name, vendor_dosage, is_active, imported_category_key
)
select
  area.key,
  p.id,
  p.code,
  p.name,
  p.dosage_vial,
  true,
  case
    when p.code = 'QA-OIL-001' then 'injectable-oils'
    when p.code = 'QA-ORAL-001' then 'orals'
    when p.code = 'QA-WATER-001' then 'reconstitution-water'
    else 'peptides'
  end
from public.products p
cross join (values ('shop'), ('group_buy_1')) as area(key)
where p.code in ('QA-PEP-001', 'QA-OIL-001', 'QA-ORAL-001', 'QA-WATER-001', 'QA-KIT-001')
on conflict (shop_area_key, vendor_code) do update set
  product_id = excluded.product_id,
  vendor_name = excluded.vendor_name,
  vendor_dosage = excluded.vendor_dosage,
  is_active = true,
  imported_category_key = excluded.imported_category_key;

-- Vendor-only (no master product) for identity tests
insert into public.shop_area_products (
  shop_area_key, product_id, vendor_code, vendor_name, vendor_dosage, is_active, imported_category_key
)
values
  ('shop', null, 'QA-VENDOR-ONLY', 'QA Vendor Only Peptide', '2 mg', true, 'peptides'),
  ('group_buy_1', null, 'QA-VENDOR-ONLY', 'QA Vendor Only Peptide', '2 mg', true, 'peptides')
on conflict (shop_area_key, vendor_code) do update set
  product_id = null,
  vendor_name = excluded.vendor_name,
  vendor_dosage = excluded.vendor_dosage,
  is_active = true;

insert into public.shop_area_product_prices (
  shop_area_key, product_id, vendor_code, price_usd, bulk_price_usd, bulk_price_min_quantity
)
values
  ('shop', null, 'QA-VENDOR-ONLY', 33.0000, null, null),
  ('group_buy_1', null, 'QA-VENDOR-ONLY', 33.0000, null, null)
on conflict (shop_area_key, vendor_code) do update set
  price_usd = excluded.price_usd;

-- Optional area price override for Group Buy markup checks
insert into public.shop_area_product_prices (
  shop_area_key, product_id, vendor_code, price_usd, bulk_price_usd, bulk_price_min_quantity
)
select
  'group_buy_1',
  p.id,
  p.code,
  38.0000,
  34.0000,
  10
from public.products p
where p.code = 'QA-KIT-001'
on conflict (shop_area_key, vendor_code) do update set
  price_usd = excluded.price_usd,
  bulk_price_usd = excluded.bulk_price_usd,
  bulk_price_min_quantity = excluded.bulk_price_min_quantity;

-- Payment: crypto on, paypal/bank off (fail-closed baseline)
insert into public.app_settings (key, value_bool)
values
  ('payment_crypto_enabled', true),
  ('payment_paypal_enabled', false),
  ('payment_bank_transfer_enabled', false)
on conflict (key) do update set value_bool = excluded.value_bool;

-- Exchange rate for EUR snapshots (optional but helpful)
insert into public.exchange_rates (base_currency, quote_currency, rate, source, fetched_at)
select 'USD', 'EUR', 0.920000, 'qa-local', now()
where not exists (
  select 1 from public.exchange_rates
  where base_currency = 'USD' and quote_currency = 'EUR'
);
