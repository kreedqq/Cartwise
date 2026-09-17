-- 0111_product_media_badge.sql
-- Optional product hero image + admin-configured badge (no fake scarcity data).

alter table public.products
  add column if not exists image_path text;

alter table public.products
  add column if not exists badge_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_image_path_len') then
    alter table public.products
      add constraint products_image_path_len
      check (image_path is null or char_length(image_path) between 1 and 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_badge_key_allowed') then
    alter table public.products
      add constraint products_badge_key_allowed
      check (
        badge_key is null
        or badge_key in ('bestseller', 'new', 'limited', 'premium')
      );
  end if;
end $$;

comment on column public.products.image_path is
  'Storage path in product-media bucket. NULL = use storefront placeholder.';
comment on column public.products.badge_key is
  'Optional admin badge. Must not imply stock or demand.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_media_select on storage.objects;
create policy product_media_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-media');

drop policy if exists product_media_admin_insert on storage.objects;
create policy product_media_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-media'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'products'
  );

drop policy if exists product_media_admin_update on storage.objects;
create policy product_media_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-media' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'product-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists product_media_admin_delete on storage.objects;
create policy product_media_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-media' and public.has_role(auth.uid(), 'admin'));
