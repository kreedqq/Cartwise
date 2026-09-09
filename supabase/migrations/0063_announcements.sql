-- 0063_announcements.sql
-- Public news feed. Customers read published rows only. Admin CRUD via RLS.

create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  published     boolean not null default false,
  pinned        boolean not null default false,
  image_url     text,
  external_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  constraint announcements_title_len check (char_length(title) between 1 and 160),
  constraint announcements_content_len check (char_length(content) between 1 and 8000),
  constraint announcements_image_url_len check (image_url is null or char_length(image_url) <= 500),
  constraint announcements_external_url_len check (external_url is null or char_length(external_url) <= 500)
);

comment on table public.announcements is
  'Customer news feed. Unpublished drafts are admin-only.';

create index if not exists announcements_feed_idx
  on public.announcements (pinned desc, published_at desc, created_at desc)
  where published = true;

alter table public.announcements enable row level security;

drop policy if exists announcements_select_published_or_admin on public.announcements;
create policy announcements_select_published_or_admin
  on public.announcements for select
  to authenticated
  using (published = true or public.has_role(auth.uid(), 'admin'));

drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert
  on public.announcements for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_admin_update
  on public.announcements for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete
  on public.announcements for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create or replace function public.announcements_set_published_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.published then
      new.published_at := coalesce(new.published_at, now());
    else
      new.published_at := null;
    end if;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    return new;
  end if;

  if new.published and (old.published is distinct from true) then
    new.published_at := now();
  elsif not new.published then
    new.published_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.announcements_set_published_at() from public, anon, authenticated;

drop trigger if exists announcements_published_at on public.announcements;
create trigger announcements_published_at
  before insert or update on public.announcements
  for each row execute function public.announcements_set_published_at();
