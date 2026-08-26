-- 0014_bulk_pricing.sql
-- Adds dosage/vial info and a two-tier price model (normal price + optional
-- bulk price from a minimum quantity onwards) to the product catalog, carries
-- that structure into the cart price snapshot, and extends the product import
-- pipeline so no imported field is silently dropped any more.
--
-- Pricing rule (single source of truth, mirrored in src/lib/money.ts
-- getEffectiveUnitPrice):
--   quantity <  bulk_price_min_quantity  -> price_usd
--   quantity >= bulk_price_min_quantity  -> bulk_price_usd
--   no bulk price configured             -> price_usd
-- The bulk price applies to *every* unit once the threshold is reached
-- (12 x 55 = 660, not 9 x 60 + 3 x 55).

-- ---------------------------------------------------------------------------
-- 1. products: dosage/vial + bulk price tier
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists dosage_vial text,
  add column if not exists bulk_price_usd numeric(12, 4),
  add column if not exists bulk_price_min_quantity numeric(12, 3);

comment on column public.products.dosage_vial is
  'Free-text dosage / vial description (e.g. "10 mg / Vial"). Display + import only, never part of a price calculation.';
comment on column public.products.bulk_price_usd is
  'Optional volume unit price in USD, applied to every unit once quantity >= bulk_price_min_quantity. NULL means "no bulk tier".';
comment on column public.products.bulk_price_min_quantity is
  'Minimum quantity at which bulk_price_usd replaces price_usd. Always NULL or NOT NULL together with bulk_price_usd.';

-- Either both bulk columns are set or neither is - a bulk price without a
-- threshold (or vice versa) is not interpretable, so it must never be stored.
alter table public.products
  drop constraint if exists products_bulk_price_pair_chk;
alter table public.products
  add constraint products_bulk_price_pair_chk check (
    (bulk_price_usd is null and bulk_price_min_quantity is null)
    or (bulk_price_usd is not null and bulk_price_min_quantity is not null)
  );

alter table public.products
  drop constraint if exists products_bulk_price_nonnegative_chk;
alter table public.products
  add constraint products_bulk_price_nonnegative_chk check (
    bulk_price_usd is null or bulk_price_usd >= 0
  );

alter table public.products
  drop constraint if exists products_bulk_price_min_quantity_positive_chk;
alter table public.products
  add constraint products_bulk_price_min_quantity_positive_chk check (
    bulk_price_min_quantity is null or bulk_price_min_quantity > 0
  );

-- Speeds up "which products actually have a bulk tier" admin filters.
create index if not exists products_bulk_price_idx
  on public.products (bulk_price_min_quantity)
  where bulk_price_usd is not null;

-- ---------------------------------------------------------------------------
-- 2. product_price_history: track all three price-relevant fields
-- ---------------------------------------------------------------------------

alter table public.product_price_history
  add column if not exists old_bulk_price_usd numeric(12, 4),
  add column if not exists new_bulk_price_usd numeric(12, 4),
  add column if not exists old_bulk_price_min_quantity numeric(12, 3),
  add column if not exists new_bulk_price_min_quantity numeric(12, 3);

comment on table public.product_price_history is
  'Append-only history of every change to price_usd, bulk_price_usd or bulk_price_min_quantity. new_price_usd always carries the normal price after the change, even when only the bulk tier moved.';

-- last_price_change_at must also move when only the bulk tier changes,
-- otherwise the admin UI would claim the price is older than it is.
create or replace function public.products_before_write()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  if new.code = '' then
    raise exception 'Artikelcode darf nicht leer sein.' using errcode = '23514';
  end if;

  new.dosage_vial := nullif(trim(coalesce(new.dosage_vial, '')), '');

  if tg_op = 'INSERT' then
    new.last_price_change_at := now();
  elsif tg_op = 'UPDATE' and (
    new.price_usd is distinct from old.price_usd
    or new.bulk_price_usd is distinct from old.bulk_price_usd
    or new.bulk_price_min_quantity is distinct from old.bulk_price_min_quantity
  ) then
    new.last_price_change_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.products_log_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.product_price_history (
      product_id, old_price_usd, new_price_usd,
      old_bulk_price_usd, new_bulk_price_usd,
      old_bulk_price_min_quantity, new_bulk_price_min_quantity,
      changed_by
    )
    values (
      new.id, null, new.price_usd,
      null, new.bulk_price_usd,
      null, new.bulk_price_min_quantity,
      auth.uid()
    );
  elsif tg_op = 'UPDATE' and (
    new.price_usd is distinct from old.price_usd
    or new.bulk_price_usd is distinct from old.bulk_price_usd
    or new.bulk_price_min_quantity is distinct from old.bulk_price_min_quantity
  ) then
    insert into public.product_price_history (
      product_id, old_price_usd, new_price_usd,
      old_bulk_price_usd, new_bulk_price_usd,
      old_bulk_price_min_quantity, new_bulk_price_min_quantity,
      changed_by
    )
    values (
      new.id, old.price_usd, new.price_usd,
      old.bulk_price_usd, new.bulk_price_usd,
      old.bulk_price_min_quantity, new.bulk_price_min_quantity,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. cart_items: snapshot the whole price structure, not just one number
-- ---------------------------------------------------------------------------
-- unit_price_usd_snapshot keeps its meaning: the unit price actually applied.
-- The three new columns record *why* that price was chosen, and let a pure
-- quantity edit re-select the tier from the frozen catalog state without
-- pulling in a newer catalog price behind the user's back.

alter table public.cart_items
  add column if not exists normal_price_usd_snapshot numeric(12, 4),
  add column if not exists bulk_price_usd_snapshot numeric(12, 4),
  add column if not exists bulk_price_min_quantity_snapshot numeric(12, 3),
  add column if not exists applied_price_tier text;

alter table public.cart_items
  drop constraint if exists cart_items_applied_price_tier_chk;
alter table public.cart_items
  add constraint cart_items_applied_price_tier_chk check (
    applied_price_tier is null or applied_price_tier in ('normal', 'bulk')
  );

comment on column public.cart_items.unit_price_usd_snapshot is
  'The unit price actually applied to this line (normal or bulk tier). All totals - including the cart_summaries view - build on this column.';
comment on column public.cart_items.normal_price_usd_snapshot is
  'The catalog normal price at snapshot time. Kept so a quantity change can re-select the tier from the frozen price structure.';
comment on column public.cart_items.applied_price_tier is
  'Which tier produced unit_price_usd_snapshot: normal or bulk. Makes the applied price auditable after the fact.';

-- Backfill existing lines: before this migration every price was a normal
-- price, so the frozen structure is "normal price only, no bulk tier".
update public.cart_items
set normal_price_usd_snapshot = unit_price_usd_snapshot,
    applied_price_tier = 'normal'
where unit_price_usd_snapshot is not null
  and normal_price_usd_snapshot is null;

-- duplicate_cart must carry the new snapshot columns, otherwise a copied
-- cart would lose the tier information and reprice differently.
create or replace function public.duplicate_cart(_cart_id uuid, _new_name text)
returns uuid
language plpgsql
as $$
declare
  _new_cart_id uuid;
begin
  if not exists (
    select 1 from public.carts where id = _cart_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'Warenkorb wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into public.carts (user_id, name, status, note)
  select user_id, _new_name, 'draft', note
  from public.carts
  where id = _cart_id
  returning id into _new_cart_id;

  insert into public.cart_items (
    cart_id, position, product_id, product_code_input, product_code_snapshot,
    product_name_snapshot, quantity, unit_price_usd_snapshot, exchange_rate_snapshot,
    eur_value_snapshot, price_snapshot_at, resolution_status, note,
    normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier
  )
  select
    _new_cart_id, position, product_id, product_code_input, product_code_snapshot,
    product_name_snapshot, quantity, unit_price_usd_snapshot, exchange_rate_snapshot,
    eur_value_snapshot, price_snapshot_at, resolution_status, note,
    normal_price_usd_snapshot, bulk_price_usd_snapshot,
    bulk_price_min_quantity_snapshot, applied_price_tier
  from public.cart_items
  where cart_id = _cart_id;

  return _new_cart_id;
end;
$$;

comment on function public.duplicate_cart(uuid, text) is
  'Copies a cart and all its line items (including the full price snapshot and applied tier) into a new draft cart.';

-- ---------------------------------------------------------------------------
-- 4. pdf_import_rows: room for every importable product field
-- ---------------------------------------------------------------------------

alter table public.pdf_import_rows
  add column if not exists parsed_dosage_vial text,
  add column if not exists parsed_description text,
  add column if not exists parsed_category text,
  add column if not exists parsed_bulk_price_usd numeric(12, 4),
  add column if not exists parsed_bulk_price_min_quantity numeric(12, 3),
  add column if not exists parsed_is_active boolean;

comment on table public.pdf_import_rows is
  'Per-line detail of a PDF/CSV/XLSX product import: raw text, every parsed field, the resolved decision, and the outcome.';

-- 'auto' lets the client hand the create-vs-update decision to the server,
-- which resolves it by article code at apply time (see apply_pdf_import).
alter table public.pdf_import_rows
  drop constraint if exists pdf_import_rows_action_check;
alter table public.pdf_import_rows
  drop constraint if exists pdf_import_rows_action_chk;
alter table public.pdf_import_rows
  add constraint pdf_import_rows_action_chk check (
    action is null or action in ('auto', 'create', 'update', 'skip')
  );

-- ---------------------------------------------------------------------------
-- 5. Storage: the import bucket now also accepts CSV and XLSX
-- ---------------------------------------------------------------------------
-- The client sets an explicit contentType per extension (see
-- src/services/pdfImport.ts), so this allowlist can stay tight.

update storage.buckets
set allowed_mime_types = array[
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
where id = 'pdf-imports';

-- ---------------------------------------------------------------------------
-- 6. apply_pdf_import: all fields + server-side upsert by article code
-- ---------------------------------------------------------------------------
-- The parameter list is deliberately UNCHANGED (text, text, integer, boolean,
-- jsonb). All new per-row fields travel inside the existing _rows jsonb
-- payload, so this is a true CREATE OR REPLACE of the same function - it can
-- not create a second, incompatible overload, and the EXECUTE grants from
-- 0009/0010 survive untouched. The grants are re-asserted at the end anyway
-- so this file remains correct even when applied to a fresh database.

create or replace function public.apply_pdf_import(
  _file_path text,
  _file_name text,
  _file_size_bytes integer,
  _has_text_layer boolean,
  _rows jsonb
)
returns jsonb
language plpgsql
as $$
declare
  _import_id uuid;
  _row record;
  _created int := 0;
  _updated int := 0;
  _skipped int := 0;
  _failed int := 0;
  _target_id uuid;
  _normalized_code text;
  _requested_action text;
  _stored_action text;
  _result text;
  _result_message text;
  _clean_name text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Importe anwenden.' using errcode = '42501';
  end if;

  insert into public.pdf_imports (uploaded_by, file_path, file_name, file_size_bytes, status, has_text_layer)
  values (auth.uid(), _file_path, _file_name, _file_size_bytes, 'applied', _has_text_layer)
  returning id into _import_id;

  for _row in
    select *
    from jsonb_to_recordset(_rows) as x(
      row_number int,
      raw_text text,
      parsed_code text,
      parsed_name text,
      parsed_dosage_vial text,
      parsed_description text,
      parsed_category text,
      parsed_price_usd numeric,
      parsed_bulk_price_usd numeric,
      parsed_bulk_price_min_quantity numeric,
      parsed_is_active boolean,
      quality text,
      quality_reason text,
      action text,
      target_product_id uuid
    )
  loop
    _result := null;
    _result_message := null;
    _target_id := null;
    _normalized_code := nullif(upper(trim(coalesce(_row.parsed_code, ''))), '');
    _clean_name := nullif(trim(coalesce(_row.parsed_name, '')), '');
    _requested_action := coalesce(nullif(trim(coalesce(_row.action, '')), ''), 'auto');
    _stored_action := _requested_action;

    if _requested_action = 'skip' then
      _stored_action := 'skip';
      _result := 'skipped';

    elsif _requested_action not in ('auto', 'create', 'update') then
      _result := 'failed';
      _result_message := 'Unbekannte Aktion.';

    else
      -- Validation shared by create and update. The bulk tier is only
      -- interpretable as a pair, so half a pair is a hard error - never a
      -- silently ignored field.
      if _normalized_code is null then
        _result := 'failed';
        _result_message := 'Artikelcode fehlt.';
      elsif _row.parsed_bulk_price_usd is not null and _row.parsed_bulk_price_min_quantity is null then
        _result := 'failed';
        _result_message := 'Mengenpreis ohne "Mengenpreis ab" - bitte beide Werte angeben.';
      elsif _row.parsed_bulk_price_min_quantity is not null and _row.parsed_bulk_price_usd is null then
        _result := 'failed';
        _result_message := '"Mengenpreis ab" ohne Mengenpreis - bitte beide Werte angeben.';
      elsif _row.parsed_bulk_price_usd is not null and _row.parsed_bulk_price_usd < 0 then
        _result := 'failed';
        _result_message := 'Mengenpreis darf nicht negativ sein.';
      elsif _row.parsed_bulk_price_min_quantity is not null and _row.parsed_bulk_price_min_quantity <= 0 then
        _result := 'failed';
        _result_message := '"Mengenpreis ab" muss größer als 0 sein.';
      elsif _row.parsed_price_usd is not null and _row.parsed_price_usd < 0 then
        _result := 'failed';
        _result_message := 'Normalpreis darf nicht negativ sein.';
      end if;

      if _result is null then
        -- Article code is the unique key: resolve the target server-side so a
        -- product created between preview and apply is still matched.
        if _row.target_product_id is not null then
          select id into _target_id from public.products where id = _row.target_product_id;
        end if;
        if _target_id is null then
          select id into _target_id from public.products where code = _normalized_code;
        end if;

        _stored_action := case when _target_id is null then 'create' else 'update' end;

        if _stored_action = 'create' then
          if _clean_name is null or _row.parsed_price_usd is null then
            _result := 'failed';
            _result_message := 'Artikelcode, Name und Normalpreis werden für eine Neuanlage benötigt.';
          else
            insert into public.products (
              code, name, dosage_vial, description, category,
              price_usd, bulk_price_usd, bulk_price_min_quantity, is_active
            )
            values (
              _normalized_code,
              _clean_name,
              nullif(trim(coalesce(_row.parsed_dosage_vial, '')), ''),
              nullif(trim(coalesce(_row.parsed_description, '')), ''),
              nullif(trim(coalesce(_row.parsed_category, '')), ''),
              _row.parsed_price_usd,
              _row.parsed_bulk_price_usd,
              _row.parsed_bulk_price_min_quantity,
              coalesce(_row.parsed_is_active, true)
            )
            returning id into _target_id;
            _result := 'created';
          end if;
        else
          -- Every provided field is written; omitted fields keep their
          -- current value. Clearing a value is done in the admin UI, not by
          -- an import, so an incomplete file can never wipe good data.
          update public.products
          set
            name = coalesce(_clean_name, name),
            dosage_vial = coalesce(nullif(trim(coalesce(_row.parsed_dosage_vial, '')), ''), dosage_vial),
            description = coalesce(nullif(trim(coalesce(_row.parsed_description, '')), ''), description),
            category = coalesce(nullif(trim(coalesce(_row.parsed_category, '')), ''), category),
            price_usd = coalesce(_row.parsed_price_usd, price_usd),
            bulk_price_usd = coalesce(_row.parsed_bulk_price_usd, bulk_price_usd),
            bulk_price_min_quantity =
              coalesce(_row.parsed_bulk_price_min_quantity, bulk_price_min_quantity),
            is_active = coalesce(_row.parsed_is_active, is_active)
          where id = _target_id;
          _result := 'updated';
        end if;
      end if;
    end if;

    insert into public.pdf_import_rows (
      import_id, row_number, raw_text,
      parsed_code, parsed_name, parsed_dosage_vial, parsed_description, parsed_category,
      parsed_price_usd, parsed_bulk_price_usd, parsed_bulk_price_min_quantity, parsed_is_active,
      quality, quality_reason, action, target_product_id, result, result_message
    )
    values (
      _import_id, _row.row_number, _row.raw_text,
      _row.parsed_code, _row.parsed_name, _row.parsed_dosage_vial, _row.parsed_description, _row.parsed_category,
      _row.parsed_price_usd, _row.parsed_bulk_price_usd, _row.parsed_bulk_price_min_quantity, _row.parsed_is_active,
      coalesce(_row.quality, case when _result = 'failed' then 'error' else 'ok' end),
      _row.quality_reason,
      _stored_action,
      case when _result in ('created', 'updated') then _target_id else null end,
      _result,
      _result_message
    );

    if _result = 'created' then
      _created := _created + 1;
    elsif _result = 'updated' then
      _updated := _updated + 1;
    elsif _result = 'skipped' then
      _skipped := _skipped + 1;
    else
      _failed := _failed + 1;
    end if;
  end loop;

  update public.pdf_imports
  set summary_created = _created,
      summary_updated = _updated,
      summary_skipped = _skipped,
      summary_failed = _failed
  where id = _import_id;

  perform public.log_audit(
    auth.uid(), 'import.apply', 'pdf_import', _import_id, null,
    jsonb_build_object('created', _created, 'updated', _updated, 'skipped', _skipped, 'failed', _failed)
  );

  return jsonb_build_object(
    'importId', _import_id,
    'created', _created,
    'updated', _updated,
    'skipped', _skipped,
    'failed', _failed
  );
end;
$$;

comment on function public.apply_pdf_import(text, text, integer, boolean, jsonb) is
  'Applies a reviewed PDF/CSV/XLSX product import batch as one transaction. Upserts by normalized article code (create when unknown, update when known) and persists every imported field. See docs/KONZEPT.md.';

-- Re-assert the grants from 0009/0010 so this migration is also correct when
-- applied to a database where the function was created fresh.
revoke all on function public.apply_pdf_import(text, text, integer, boolean, jsonb) from public;
grant execute on function public.apply_pdf_import(text, text, integer, boolean, jsonb) to authenticated;
