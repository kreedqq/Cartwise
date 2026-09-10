-- 0065_announcement_media_design_feedback.sql
-- Additive: announcement storage path, site design settings, verified order feedback.
-- Does not rewrite orders, order_items, prices, role snapshots, or maintenance assets.

-- ---------------------------------------------------------------------------
-- Announcements: optional stored image (keeps existing image_url for legacy links)
-- ---------------------------------------------------------------------------

alter table public.announcements
  add column if not exists image_path text;

alter table public.announcements
  add column if not exists image_focal_x numeric not null default 50;

alter table public.announcements
  add column if not exists image_focal_y numeric not null default 50;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_image_path_len'
  ) then
    alter table public.announcements
      add constraint announcements_image_path_len
      check (image_path is null or char_length(image_path) between 1 and 500);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_image_focal_x_range'
  ) then
    alter table public.announcements
      add constraint announcements_image_focal_x_range
      check (image_focal_x between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_image_focal_y_range'
  ) then
    alter table public.announcements
      add constraint announcements_image_focal_y_range
      check (image_focal_y between 0 and 100);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Site design: one persistent row (not a second boolean-flag engine)
-- ---------------------------------------------------------------------------

create table if not exists public.site_design_settings (
  id          boolean primary key default true check (id),
  enabled     boolean not null default false,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

comment on table public.site_design_settings is
  'Single-row website background config. Independent of maintenance artwork.';

insert into public.site_design_settings (id, enabled, config)
values (true, false, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_design_settings enable row level security;

drop policy if exists site_design_select_authenticated on public.site_design_settings;
create policy site_design_select_authenticated
  on public.site_design_settings for select
  to authenticated
  using (true);

drop policy if exists site_design_admin_update on public.site_design_settings;
create policy site_design_admin_update
  on public.site_design_settings for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists site_design_admin_insert on public.site_design_settings;
create policy site_design_admin_insert
  on public.site_design_settings for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.site_design_settings to authenticated;
grant select, insert, update, delete on public.site_design_settings to service_role;

drop trigger if exists site_design_settings_set_updated_at on public.site_design_settings;
create trigger site_design_settings_set_updated_at
  before update on public.site_design_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Verified order feedback
-- ---------------------------------------------------------------------------

create table if not exists public.order_feedback (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete restrict,
  user_id        uuid references auth.users (id) on delete set null,
  rating         integer not null,
  body           text not null,
  image_path     text,
  image_consent  boolean not null default false,
  status         text not null default 'pending',
  display_name   text,
  is_featured    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  approved_at    timestamptz,
  approved_by    uuid references auth.users (id) on delete set null,
  constraint order_feedback_order_unique unique (order_id),
  constraint order_feedback_rating_range check (rating between 1 and 5),
  constraint order_feedback_body_len check (char_length(btrim(body)) between 10 and 2000),
  constraint order_feedback_status_check check (status in ('pending', 'approved', 'rejected', 'hidden')),
  constraint order_feedback_display_name_len check (display_name is null or char_length(btrim(display_name)) between 1 and 40),
  constraint order_feedback_image_path_len check (image_path is null or char_length(image_path) between 1 and 500),
  constraint order_feedback_image_consent_required check (image_path is null or image_consent = true)
);

comment on table public.order_feedback is
  'One review per order. Public feed shows approved rows only.';

create index if not exists order_feedback_public_idx
  on public.order_feedback (is_featured desc, created_at desc)
  where status = 'approved';

create index if not exists order_feedback_user_idx
  on public.order_feedback (user_id, created_at desc);

alter table public.order_feedback enable row level security;

drop policy if exists order_feedback_select on public.order_feedback;
create policy order_feedback_select
  on public.order_feedback for select
  to authenticated
  using (
    status = 'approved'
    or user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists order_feedback_insert_own on public.order_feedback;
create policy order_feedback_insert_own
  on public.order_feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
        and o.status in ('received', 'shipped', 'completed')
    )
  );

drop policy if exists order_feedback_update_own_pending on public.order_feedback;
create policy order_feedback_update_own_pending
  on public.order_feedback for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending' and is_featured = false);

drop policy if exists order_feedback_admin_update on public.order_feedback;
create policy order_feedback_admin_update
  on public.order_feedback for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists order_feedback_admin_delete on public.order_feedback;
create policy order_feedback_admin_delete
  on public.order_feedback for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.order_feedback to authenticated;
grant select, insert, update, delete on public.order_feedback to service_role;

drop trigger if exists order_feedback_set_updated_at on public.order_feedback;
create trigger order_feedback_set_updated_at
  before update on public.order_feedback
  for each row execute function public.set_updated_at();

create or replace function public.order_feedback_protect_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.has_role(auth.uid(), 'admin');
begin
  if tg_op = 'INSERT' then
    if not is_admin then
      new.user_id := auth.uid();
      new.status := 'pending';
      new.is_featured := false;
      new.approved_at := null;
      new.approved_by := null;
    end if;
    if new.display_name is not null then
      new.display_name := nullif(btrim(new.display_name), '');
    end if;
    new.body := btrim(new.body);
    return new;
  end if;

  if not is_admin then
    new.order_id := old.order_id;
    new.user_id := old.user_id;
    new.status := 'pending';
    new.is_featured := false;
    new.approved_at := null;
    new.approved_by := null;
  elsif new.status = 'approved' and (old.status is distinct from 'approved') then
    new.approved_at := coalesce(new.approved_at, now());
    new.approved_by := coalesce(new.approved_by, auth.uid());
  elsif new.status is distinct from 'approved' then
    new.approved_at := null;
    new.approved_by := null;
  end if;
  if new.display_name is not null then
    new.display_name := nullif(btrim(new.display_name), '');
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;

revoke all on function public.order_feedback_protect_row() from public, anon, authenticated;
grant execute on function public.order_feedback_protect_row() to authenticated, service_role;

drop trigger if exists order_feedback_protect_row on public.order_feedback;
create trigger order_feedback_protect_row
  before insert or update on public.order_feedback
  for each row execute function public.order_feedback_protect_row();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'announcement-media',
    'announcement-media',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'site-design',
    'site-design',
    true,
    8388608,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'feedback-media',
    'feedback-media',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists announcement_media_admin_select on storage.objects;
create policy announcement_media_admin_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'announcement-media');

drop policy if exists announcement_media_admin_insert on storage.objects;
create policy announcement_media_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'announcement-media'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'announcements'
  );

drop policy if exists announcement_media_admin_update on storage.objects;
create policy announcement_media_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'announcement-media' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'announcement-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists announcement_media_admin_delete on storage.objects;
create policy announcement_media_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'announcement-media' and public.has_role(auth.uid(), 'admin'));

drop policy if exists site_design_select on storage.objects;
create policy site_design_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'site-design');

drop policy if exists site_design_admin_insert on storage.objects;
create policy site_design_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-design'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] in ('desktop', 'tablet', 'mobile')
  );

drop policy if exists site_design_admin_update on storage.objects;
create policy site_design_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-design' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'site-design' and public.has_role(auth.uid(), 'admin'));

drop policy if exists site_design_admin_delete on storage.objects;
create policy site_design_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-design' and public.has_role(auth.uid(), 'admin'));

drop policy if exists feedback_media_select on storage.objects;
create policy feedback_media_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'feedback-media'
    and (
      public.has_role(auth.uid(), 'admin')
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.order_feedback f
        where f.image_path = name
          and f.status = 'approved'
      )
    )
  );

drop policy if exists feedback_media_insert on storage.objects;
create policy feedback_media_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'feedback-media'
    and (
      public.has_role(auth.uid(), 'admin')
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists feedback_media_delete on storage.objects;
create policy feedback_media_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'feedback-media'
    and (
      public.has_role(auth.uid(), 'admin')
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
