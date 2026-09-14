import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = fs.readFileSync(
  path.join(root, "supabase/migrations/0088_checkout_skip_incomplete_kit_lines.sql"),
  "utf8",
);
const start = src.indexOf("create or replace function public.create_one_area_order");
const end = src.indexOf("revoke all on function public.create_one_area_order");
if (start < 0 || end < 0) throw new Error("create_one_area_order block not found");
let fn = src.slice(start, end);

fn = fn.replace(
  `insert into public.order_items (
      order_id, position, product_id,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _master_id,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, case when public.quantity_discounts_enabled() then _product.bulk_price_min_quantity else null end,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    )`,
  `insert into public.order_items (
      order_id, position, product_id,
      kit_share_id_snapshot, kit_size_vials_snapshot, kit_participant_quantity_snapshot,
      product_code_snapshot, product_name_snapshot, dosage_vial_snapshot, description_snapshot,
      normal_price_usd_snapshot, bulk_price_usd_snapshot, bulk_price_min_quantity_snapshot,
      applied_price_tier, unit_price_usd_snapshot, quantity, line_total_usd,
      exchange_rate_snapshot, eur_value_snapshot
    )
    values (
      _order_id, _position, _master_id,
      case when _item.kit_share_id is not null then _item.kit_share_id else null end,
      case when _item.kit_share_id is not null then _kit.kit_size_vials else null end,
      case when _item.kit_share_id is not null then _kit_participant.quantity else null end,
      _product.code, _product.name, _product.dosage_vial, _product.description,
      _normal, _bulk, case when public.quantity_discounts_enabled() then _product.bulk_price_min_quantity else null end,
      _tier, _sell, _item.quantity, _line_total,
      _rate, _eur
    )`,
);

const header = `-- 0092_order_corrections_and_kit_snapshots.sql
-- Kit snapshots on order_items at checkout; order revision audit; admin correction RPC.
-- Additive. Does not change 0088 checkout skip semantics.

alter table public.order_items
  add column if not exists kit_share_id_snapshot uuid references public.kit_shares (id) on delete set null,
  add column if not exists kit_size_vials_snapshot integer,
  add column if not exists kit_participant_quantity_snapshot numeric(12, 3);

comment on column public.order_items.kit_share_id_snapshot is
  'Kit share at order time; corrections/display must not rely on live kit alone.';
comment on column public.order_items.kit_size_vials_snapshot is
  'Kit size (vials) frozen at order creation.';
comment on column public.order_items.kit_participant_quantity_snapshot is
  'Participant share quantity frozen at order creation.';

alter table public.orders
  add column if not exists revision_number integer not null default 0;

create table if not exists public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(trim(reason)) >= 3),
  previous_total_usd numeric(12, 2) not null,
  new_total_usd numeric(12, 2) not null,
  previous_total_eur numeric(12, 2),
  new_total_eur numeric(12, 2),
  difference_usd numeric(12, 2) not null,
  difference_eur numeric(12, 2),
  changes jsonb not null default '{}'::jsonb,
  unique (order_id, revision_number)
);

create index if not exists order_revisions_order_idx
  on public.order_revisions (order_id, revision_number desc);

alter table public.order_revisions enable row level security;

drop policy if exists order_revisions_select_admin on public.order_revisions;
create policy order_revisions_select_admin
  on public.order_revisions for select
  using (public.has_role(auth.uid(), 'admin'));

`;

const existing = fs.readFileSync(path.join(root, "supabase/migrations/0092_order_corrections_and_kit_snapshots.sql"), "utf8");
const rpcStart = existing.indexOf("create or replace function public.admin_apply_order_correction");
if (rpcStart < 0) throw new Error("admin_apply_order_correction block not found in 0092");
const rpc = existing.slice(rpcStart);

const out = header + "\n" + fn + "\n" + rpc;
fs.writeFileSync(path.join(root, "supabase/migrations/0092_order_corrections_and_kit_snapshots.sql"), out);
console.log("Wrote 0092", out.length, "bytes");
