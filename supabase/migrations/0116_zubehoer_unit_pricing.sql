-- 0116_zubehoer_unit_pricing.sql
-- Production PenBuddy area uses category_key zubehoer (same per-piece pricing as accessories).

create or replace function public.vendor_category_as_product_category(_category_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(replace(replace(trim(coalesce(_category_key, '')), '_', '-'), ' ', '-'))
    when 'peptides' then 'Peptides'
    when 'orals' then 'Orals'
    when 'injectable-oils' then 'Injectable Oils'
    when 'reconstitution-water' then 'Reconstitution Water'
    when 'accessories' then 'Accessories'
    when 'zubehoer' then 'Accessories'
    else null
  end;
$$;

revoke all on function public.vendor_category_as_product_category(text)
  from public, anon, authenticated;

create or replace function public.product_uses_kit_unit_pricing(_product public.products)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    case
      when lower(trim(coalesce(_product.name, ''))) in ('bac water', 'aa water') then true
      when upper(trim(coalesce(_product.code, ''))) in ('AA10', 'BA03', 'BA10') then true
      when lower(replace(replace(trim(coalesce(_product.category, '')), '_', '-'), ' ', '-'))
           like '%reconstitution%' then true
      when lower(replace(replace(trim(coalesce(_product.category, '')), '_', '-'), ' ', '-'))
           like '%accessor%' then false
      when lower(replace(replace(trim(coalesce(_product.category, '')), '_', '-'), ' ', '-'))
           like '%zubehoer%' then false
      when lower(trim(coalesce(_product.category, ''))) like '%peptide%' then true
      when lower(trim(coalesce(_product.category, ''))) like '%oral%' then false
      when lower(trim(coalesce(_product.category, ''))) like '%oil%'
        or lower(trim(coalesce(_product.category, ''))) like '%inject%' then false
      else true
    end;
$$;

revoke all on function public.product_uses_kit_unit_pricing(public.products) from public;
