-- 0012_optimistic_locking.sql
-- Automatic version bumping for optimistic concurrency control on carts and
-- cart_items (see docs/SECURITY.md "Race Conditions / Lost Updates").
--
-- Client pattern:
--   supabase.from('cart_items')
--     .update({ quantity: 5 })
--     .eq('id', itemId)
--     .eq('version', expectedVersion)
--     .select()
--
-- If the row's version has moved on (someone else edited it since it was
-- loaded), the WHERE clause matches zero rows, .select() returns an empty
-- array, and the client surfaces a conflict instead of silently overwriting
-- a concurrent change.

create or replace function public.bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

comment on function public.bump_version() is
  'Trigger: increments version on every UPDATE, enabling optimistic locking via WHERE version = :expected.';

create trigger carts_bump_version
  before update on public.carts
  for each row execute function public.bump_version();

create trigger cart_items_bump_version
  before update on public.cart_items
  for each row execute function public.bump_version();
