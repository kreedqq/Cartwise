-- 0017_order_templates_and_admin_notes.sql
-- Follow-up to 0016_orders.sql:
--   1. Isolate the internal admin note so a customer SELECT on orders can
--      never return it (section 29 / 44).
--   2. Named reorder-templates ("Bestellvorlagen", section 26): a customer
--      can save a code+quantity list and later load it into the active cart
--      at *today's* catalog prices (never the prices from when the template
--      was saved).

-- ---------------------------------------------------------------------------
-- 1. order_admin_notes - admin-only, one optional row per order
-- ---------------------------------------------------------------------------

create table public.order_admin_notes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  note text not null check (char_length(trim(note)) >= 1),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.order_admin_notes is
  'Internal admin-only note for an order. Never readable by the customer (no SELECT policy for non-admins).';

alter table public.order_admin_notes enable row level security;

create policy "order_admin_notes_admin_all"
  on public.order_admin_notes for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Copy any notes written while 0016 still stored them on orders.admin_note,
-- then drop that column so PostgREST `select *` on orders can never leak it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'admin_note'
  ) then
    insert into public.order_admin_notes (order_id, note, updated_at)
    select id, admin_note, updated_at
    from public.orders
    where admin_note is not null and trim(admin_note) <> ''
    on conflict (order_id) do nothing;

    alter table public.orders drop column admin_note;
  end if;
end
$$;

grant select, insert, update, delete on public.order_admin_notes to authenticated;
grant select, insert, update, delete on public.order_admin_notes to service_role;

-- ---------------------------------------------------------------------------
-- 2. set_order_status: write the isolated note table instead of a column
-- ---------------------------------------------------------------------------

create or replace function public.set_order_status(_order_id uuid, _status text, _admin_note text default null)
returns public.orders
language plpgsql
as $$
declare
  _current public.orders;
  _updated public.orders;
  _clean_note text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen den Bestellstatus ändern.' using errcode = '42501';
  end if;

  if _status not in ('pending', 'processing', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Ungültiger Status.' using errcode = '22023';
  end if;

  select * into _current from public.orders where id = _order_id for update;
  if not found then
    raise exception 'Bestellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _current.status in ('completed', 'cancelled') and _status <> _current.status then
    raise exception 'Diese Bestellung ist abgeschlossen und kann nicht mehr geändert werden.' using errcode = 'P0001';
  end if;

  update public.orders
  set status = _status
  where id = _order_id
  returning * into _updated;

  _clean_note := nullif(trim(coalesce(_admin_note, '')), '');
  if _clean_note is not null then
    insert into public.order_admin_notes (order_id, note, updated_by, updated_at)
    values (_order_id, _clean_note, auth.uid(), now())
    on conflict (order_id) do update
      set note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;

  if _status is distinct from _current.status then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (_order_id, _current.status, _status, auth.uid());

    perform public.log_audit(
      auth.uid(), 'order.status_changed', 'order', _order_id,
      jsonb_build_object('status', _current.status), jsonb_build_object('status', _status)
    );
  elsif _clean_note is not null then
    perform public.log_audit(
      auth.uid(), 'order.note_updated', 'order', _order_id, null, jsonb_build_object('adminNote', true)
    );
  end if;

  return _updated;
end;
$$;

comment on function public.set_order_status(uuid, text, text) is
  'Admin-only: changes an order''s status (terminal states are final) and optionally upserts the internal admin note in order_admin_notes.';

-- ---------------------------------------------------------------------------
-- 3. Bestellvorlagen (named code+quantity lists, owner-scoped)
-- ---------------------------------------------------------------------------

create table public.order_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.order_templates is
  'Named, per-user reorder templates. Loading a template always uses today''s catalog prices, never the prices from when it was saved.';

create trigger order_templates_set_updated_at
  before update on public.order_templates
  for each row execute function public.set_updated_at();

create index order_templates_user_idx on public.order_templates (user_id, updated_at desc);

alter table public.order_templates enable row level security;

create policy "order_templates_select_own"
  on public.order_templates for select
  using (user_id = auth.uid());

create policy "order_templates_insert_own"
  on public.order_templates for insert
  with check (user_id = auth.uid());

create policy "order_templates_update_own"
  on public.order_templates for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "order_templates_delete_own"
  on public.order_templates for delete
  using (user_id = auth.uid());

create table public.order_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.order_templates (id) on delete cascade,
  position integer not null default 0,
  product_code text not null,
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 100000)
);

comment on table public.order_template_items is
  'Code + quantity lines of an order template. Product identity is the article code, resolved against the live catalog at load time.';

create index order_template_items_template_idx
  on public.order_template_items (template_id, position);

alter table public.order_template_items enable row level security;

create policy "order_template_items_select_own"
  on public.order_template_items for select
  using (
    exists (
      select 1 from public.order_templates t
      where t.id = order_template_items.template_id and t.user_id = auth.uid()
    )
  );

create policy "order_template_items_insert_own"
  on public.order_template_items for insert
  with check (
    exists (
      select 1 from public.order_templates t
      where t.id = order_template_items.template_id and t.user_id = auth.uid()
    )
  );

create policy "order_template_items_delete_own"
  on public.order_template_items for delete
  using (
    exists (
      select 1 from public.order_templates t
      where t.id = order_template_items.template_id and t.user_id = auth.uid()
    )
  );

-- Normalize the stored article code the same way products_before_write does.
create or replace function public.order_template_items_before_write()
returns trigger
language plpgsql
as $$
begin
  new.product_code := upper(trim(new.product_code));
  if new.product_code = '' then
    raise exception 'Artikelcode darf nicht leer sein.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger order_template_items_before_write
  before insert or update on public.order_template_items
  for each row execute function public.order_template_items_before_write();

grant select, insert, update, delete on public.order_templates to authenticated;
grant select, insert, delete on public.order_template_items to authenticated;
grant select, insert, update, delete on public.order_templates to service_role;
grant select, insert, update, delete on public.order_template_items to service_role;
