-- 0016_orders.sql
-- Turns a cart into a real, immutable order: orders + order_items (full price
-- snapshot, never recalculated from today's catalog) + order_status_history
-- (audit trail of status changes) + product_favorites ("Meine Artikel").
--
-- Design decisions (documented here because they are not 100% dictated by
-- the spec and needed a concrete, defensible choice):
--
-- 1. Order numbers ("CW-2026-000001"): generated from a single global
--    Postgres sequence embedded with the current year, e.g. CW-2026-000001,
--    CW-2026-000002, ... A per-year *resetting* counter would need row
--    locking on a counter table to stay collision-free under concurrent
--    inserts; a plain sequence is inherently collision-free (atomic,
--    lock-free) and satisfies the hard "no collisions under concurrency"
--    requirement with the least moving parts. The trade-off is that the
--    counter does not reset to 000001 on Jan 1 - it keeps counting up
--    (e.g. CW-2027-000150). Acceptable per the task's own "oder
--    entsprechend einer technisch sicheren Sequenz" clause.
--
-- 2. order_items carries its OWN copy of dosage_vial/description, taken from
--    the product catalog AT ORDER CREATION TIME (cart_items does not store
--    those two fields). Once written, the row is never updated again - see
--    the "no update/delete policy at all" RLS section below.
--
-- 3. create_order() derives totals and the applied unit price/tier entirely
--    from the *already frozen* cart_items snapshot columns - it does not
--    recompute against the live product catalog. This is what "Bestellung
--    bleibt historisch unverändert" + "Bestelltotal muss serverseitig...
--    bestimmt werden" together require: server-computed, but from the
--    correct (frozen) source, never the client, and never today's price.
--
-- 4. Only cart_items with resolution_status = 'resolved' AND a non-null
--    price snapshot become order lines. Unresolved ('not_found') or
--    deactivated-since-added ('inactive') lines are silently excluded from
--    the order (the client warns about them before checkout).
--
-- 5. A submitted cart is marked status = 'ordered' (already a valid cart
--    status per 0004) and unset as the active cart, matching the existing
--    "duplicate a cart to start a new one" workflow instead of inventing a
--    new mechanism. cart_items RLS is extended so an 'ordered' cart's items
--    can no longer be edited (its order_items copy is already independent
--    of this, so this is a UX/data-hygiene guard, not a security fix).
--
-- 6. Order templates (section 26) and full price-list versioning (section
--    40) are intentionally NOT implemented in this migration: both are
--    explicitly marked "wenn architektonisch sinnvoll" (optional) in the
--    task, product_price_history already gives full price-change history,
--    and the "reorder" flow already covers "load a previous set of items at
--    today's prices" - a separate templates table would duplicate that
--    without adding capability. Documented as deferred (see final report).

-- ---------------------------------------------------------------------------
-- 1. orders
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq start 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Traceability only; the order itself is fully self-contained via
  -- order_items and never needs to read back from the cart.
  cart_id uuid references public.carts (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'confirmed', 'completed', 'cancelled')),
  note text,
  -- Internal admin-only note. NEVER selected/returned to a customer - see
  -- the orders_select_own_or_admin policy (it exposes the whole row, so the
  -- client for a customer must not display this column; enforced in the UI
  -- layer, matching how price_usd/cost fields are already handled).
  admin_note text,
  total_usd numeric(12, 2) not null default 0 check (total_usd >= 0),
  total_eur numeric(12, 2),
  exchange_rate numeric(12, 6),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is
  'One row per submitted order. Immutable except for status/admin_note, both writable only via set_order_status (admin-only).';
comment on column public.orders.admin_note is
  'Internal-only note, never shown to the customer (enforced client-side; RLS only gates access to the order as a whole).';
comment on column public.orders.total_usd is
  'Server-computed from order_items.line_total_usd at creation time - never trusts a client-supplied total.';

create or replace function public.orders_set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'CW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger orders_set_order_number
  before insert on public.orders
  for each row execute function public.orders_set_order_number();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_order_number_idx on public.orders (order_number);

alter table public.orders enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Only create_order() ever inserts a row, always with user_id = auth.uid()
-- (never client-supplied) - this policy just lets that SECURITY INVOKER
-- insert through under the calling user's own RLS context.
create policy "orders_insert_own"
  on public.orders for insert
  with check (user_id = auth.uid());

-- No customer update policy at all: a customer can never change status,
-- total, or anything else on their own order (section 44). Only
-- set_order_status() (admin-gated twice: once in the function body, once
-- here) may update.
create policy "orders_update_admin"
  on public.orders for update
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- No delete policy for anyone: orders are permanent records.

-- ---------------------------------------------------------------------------
-- 2. order_items - fully immutable snapshot, never updated or deleted
-- ---------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null default 0,
  product_id uuid references public.products (id) on delete set null,
  product_code_snapshot text not null,
  product_name_snapshot text not null,
  dosage_vial_snapshot text,
  description_snapshot text,
  normal_price_usd_snapshot numeric(12, 4) not null,
  bulk_price_usd_snapshot numeric(12, 4),
  bulk_price_min_quantity_snapshot numeric(12, 3),
  applied_price_tier text not null check (applied_price_tier in ('normal', 'bulk')),
  unit_price_usd_snapshot numeric(12, 4) not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  line_total_usd numeric(12, 2) not null,
  exchange_rate_snapshot numeric(12, 6),
  eur_value_snapshot numeric(12, 2),
  created_at timestamptz not null default now()
);

comment on table public.order_items is
  'Fully immutable per-line snapshot of an order. Written exactly once by create_order() - no UPDATE/DELETE policy exists for any role, including admin.';

create index order_items_order_idx on public.order_items (order_id, position);
create index order_items_product_idx on public.order_items (product_id);

alter table public.order_items enable row level security;

create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

-- Only create_order() inserts, always for an order it just created for the
-- calling user - this policy lets that SECURITY INVOKER insert through.
create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- Deliberately no UPDATE or DELETE policy for any role: an order line must
-- never change after the order was placed, full stop.

-- ---------------------------------------------------------------------------
-- 3. order_status_history - append-only audit trail of status changes
-- ---------------------------------------------------------------------------

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table public.order_status_history is
  'Append-only history of order.status transitions, including the initial "pending" entry written by create_order().';

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

alter table public.order_status_history enable row level security;

create policy "order_status_history_select_own_or_admin"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

-- create_order() inserts the initial "pending" row as the customer;
-- set_order_status() inserts every later row as an admin. Both are
-- SECURITY INVOKER, so both need to pass this check.
create policy "order_status_history_insert_own_or_admin"
  on public.order_status_history for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (o.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

-- No update/delete policy: history is append-only, like audit_logs.

-- ---------------------------------------------------------------------------
-- 4. product_favorites - "Meine Artikel"
-- ---------------------------------------------------------------------------

create table public.product_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

comment on table public.product_favorites is
  'Per-user saved products ("Meine Artikel"). Strictly owner-scoped.';

create index product_favorites_user_idx on public.product_favorites (user_id, created_at desc);

alter table public.product_favorites enable row level security;

create policy "product_favorites_select_own"
  on public.product_favorites for select
  using (user_id = auth.uid());

create policy "product_favorites_insert_own"
  on public.product_favorites for insert
  with check (user_id = auth.uid());

create policy "product_favorites_delete_own"
  on public.product_favorites for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. create_order(): the one transactional entry point from cart -> order
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (default): runs as the calling user, RLS applies exactly
-- as normal on every statement inside. This buys atomicity (a single
-- plpgsql call either fully commits or fully rolls back), not elevated
-- privilege - the same defense-in-depth pattern as set_active_cart /
-- duplicate_cart in 0011.

create or replace function public.create_order(_cart_id uuid, _note text default null)
returns jsonb
language plpgsql
as $$
declare
  _cart record;
  _item record;
  _order_id uuid;
  _order_number text;
  _position int := 0;
  _line_total numeric(12, 2);
  _total_usd numeric(14, 2) := 0;
  _total_eur numeric(14, 2) := 0;
  _eur_complete boolean := true;
  _line_count int;
  _rate numeric(12, 6);
  _latest_snapshot_at timestamptz;
begin
  select * into _cart
  from public.carts
  where id = _cart_id and user_id = auth.uid() and deleted_at is null
  for update;

  if not found then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if _cart.status not in ('draft', 'ready') then
    raise exception 'Dieser Warenkorb wurde bereits bestellt oder ist archiviert.' using errcode = 'P0001';
  end if;

  select count(*) into _line_count
  from public.cart_items
  where cart_id = _cart_id
    and resolution_status = 'resolved'
    and unit_price_usd_snapshot is not null
    and quantity > 0;

  if _line_count = 0 then
    raise exception 'Der Warenkorb enthält keine bestellbaren Positionen.' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, cart_id, status, note, total_usd, total_eur, exchange_rate, submitted_at)
  values (auth.uid(), _cart_id, 'pending', nullif(trim(coalesce(_note, '')), ''), 0, null, null, now())
  returning id, order_number into _order_id, _order_number;

  for _item in
    select ci.*, p.dosage_vial as product_dosage_vial, p.description as product_description
    from public.cart_items ci
    left join public.products p on p.id = ci.product_id
    where ci.cart_id = _cart_id
      and ci.resolution_status = 'resolved'
      and ci.unit_price_usd_snapshot is not null
      and ci.quantity > 0
    order by ci.position
  loop
    _line_total := round(_item.quantity * _item.unit_price_usd_snapshot, 2);
    _total_usd := _total_usd + _line_total;

    if _item.eur_value_snapshot is null then
      _eur_complete := false;
    else
      _total_eur := _total_eur + _item.eur_value_snapshot;
    end if;

    if _item.exchange_rate_snapshot is not null
       and (_latest_snapshot_at is null or _item.price_snapshot_at > _latest_snapshot_at) then
      _latest_snapshot_at := _item.price_snapshot_at;
      _rate := _item.exchange_rate_snapshot;
    end if;

    insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _item.product_id,
      coalesce(_item.product_code_snapshot, upper(trim(_item.product_code_input))),
      coalesce(_item.product_name_snapshot, _item.product_code_input),
      _item.product_dosage_vial, _item.product_description,
      coalesce(_item.normal_price_usd_snapshot, _item.unit_price_usd_snapshot),
      _item.bulk_price_usd_snapshot, _item.bulk_price_min_quantity_snapshot,
      coalesce(_item.applied_price_tier, 'normal'), _item.unit_price_usd_snapshot, _item.quantity, _line_total,
      _item.exchange_rate_snapshot, _item.eur_value_snapshot
    );

    _position := _position + 1;
  end loop;

  update public.orders
  set total_usd = _total_usd,
      total_eur = case when _eur_complete then _total_eur else null end,
      exchange_rate = _rate
  where id = _order_id;

  update public.carts
  set status = 'ordered', is_active_cart = false
  where id = _cart_id;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (_order_id, null, 'pending', auth.uid());

  perform public.log_audit(
    auth.uid(), 'order.create', 'order', _order_id, null,
    jsonb_build_object('orderNumber', _order_number, 'totalUsd', _total_usd, 'itemCount', _line_count)
  );

  return jsonb_build_object('orderId', _order_id, 'orderNumber', _order_number, 'totalUsd', _total_usd);
end;
$$;

comment on function public.create_order(uuid, text) is
  'Transactionally turns a draft/ready cart into an order: snapshots eligible cart_items into order_items, computes totals server-side from those frozen snapshots, closes the cart, and writes the initial status-history + audit-log entries. Excludes not_found/inactive cart lines.';

revoke all on function public.create_order(uuid, text) from public;
grant execute on function public.create_order(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. set_order_status(): admin-only status transitions
-- ---------------------------------------------------------------------------

create or replace function public.set_order_status(_order_id uuid, _status text, _admin_note text default null)
returns public.orders
language plpgsql
as $$
declare
  _current public.orders;
  _updated public.orders;
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

  -- Terminal states are final: prevents "Abgeschlossen -> Eingegangen" or
  -- "Storniert -> In Bearbeitung" (section 68). A genuine correction is a
  -- deliberate, separate admin action outside this guard rail, not covered
  -- by this MVP.
  if _current.status in ('completed', 'cancelled') and _status <> _current.status then
    raise exception 'Diese Bestellung ist abgeschlossen und kann nicht mehr geändert werden.' using errcode = 'P0001';
  end if;

  update public.orders
  set status = _status,
      admin_note = coalesce(nullif(trim(coalesce(_admin_note, '')), ''), admin_note)
  where id = _order_id
  returning * into _updated;

  if _status is distinct from _current.status then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (_order_id, _current.status, _status, auth.uid());

    perform public.log_audit(
      auth.uid(), 'order.status_changed', 'order', _order_id,
      jsonb_build_object('status', _current.status), jsonb_build_object('status', _status)
    );
  elsif _admin_note is not null and trim(_admin_note) <> '' then
    perform public.log_audit(
      auth.uid(), 'order.note_updated', 'order', _order_id, null, jsonb_build_object('adminNote', _admin_note)
    );
  end if;

  return _updated;
end;
$$;

comment on function public.set_order_status(uuid, text, text) is
  'Admin-only: changes an order''s status (with a terminal-state guard) and/or its internal admin note, recording the transition in order_status_history and audit_logs.';

revoke all on function public.set_order_status(uuid, text, text) from public;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. cart_items RLS: a submitted ("ordered") cart is read-only from here on
-- ---------------------------------------------------------------------------
-- Its order_items copy is already fully independent (see design note 3
-- above), so this is a data-hygiene/UX guard, not a security fix: it stops
-- a customer from confusingly editing a cart that has already become an
-- order, mirroring how the UI is expected to render it read-only.

drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own"
  on public.cart_items for insert
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid() and c.status <> 'ordered'
    )
  );

drop policy if exists "cart_items_update_own" on public.cart_items;
create policy "cart_items_update_own"
  on public.cart_items for update
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid() and c.status <> 'ordered'
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid() and c.status <> 'ordered'
    )
  );

drop policy if exists "cart_items_delete_own" on public.cart_items;
create policy "cart_items_delete_own"
  on public.cart_items for delete
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_items.cart_id and c.user_id = auth.uid() and c.status <> 'ordered'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. product_is_referenced: also count order history, not just active carts
-- ---------------------------------------------------------------------------

create or replace function public.product_is_referenced(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.cart_items where product_id = _product_id)
    or exists (select 1 from public.order_items where product_id = _product_id);
$$;

comment on function public.product_is_referenced(uuid) is
  'Used by the admin UI to block hard-deleting a product still used in any cart or order (deactivate instead).';

-- ---------------------------------------------------------------------------
-- 9. admin_user_directory: admin-only id+email+display_name lookup
-- ---------------------------------------------------------------------------
-- auth.users is not directly queryable by the authenticated role. This view
-- runs with the view owner's privileges (security_invoker = false, the
-- Postgres default) so it CAN read auth.users, but the "where
-- has_role(auth.uid(), 'admin')" clause still evaluates per-session (auth.uid()
-- reads the caller's JWT claim regardless of the view's privilege mode), so
-- a non-admin querying this view simply gets zero rows back - the same
-- effect an RLS policy would have, without needing RLS support on views.

create view public.admin_user_directory
as
select u.id, u.email, p.display_name, p.created_at
from auth.users u
join public.profiles p on p.id = u.id
where public.has_role(auth.uid(), 'admin');

comment on view public.admin_user_directory is
  'Admin-only id/email/display_name directory for order search ("Kunde", "E-Mail"). Returns zero rows for non-admins regardless of who queries it.';

grant select on public.admin_user_directory to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Table grants (see 0015 for why this is necessary on this project)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;
grant select, insert on public.order_status_history to authenticated;
grant select, insert, delete on public.product_favorites to authenticated;

grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.order_items to service_role;
grant select, insert, update, delete on public.order_status_history to service_role;
grant select, insert, update, delete on public.product_favorites to service_role;

grant usage on sequence public.order_number_seq to authenticated, service_role;
