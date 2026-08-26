-- 0009_import_rpc.sql
-- Server-side, transactional application of a reviewed PDF/CSV import batch.
--
-- The client (admin) extracts text with PDF.js, runs the heuristic parser,
-- and lets the admin edit/decide each row (see docs/KONZEPT.md, PDF-Import
-- section). Only once the admin clicks "Import anwenden" does any of this
-- reach the database, and it does so as a single function call - i.e. a
-- single Postgres transaction - so a hard failure (e.g. connection drop)
-- cannot leave a half-written import record. Per-row outcomes
-- (created/updated/skipped/failed) are business-level results, not
-- transaction failures, and are recorded individually (see docs/RISKS.md
-- for why an all-or-nothing batch was not chosen).
--
-- SECURITY INVOKER (default): runs with the caller's own privileges, so the
-- normal RLS admin-only policies on products/pdf_imports/pdf_import_rows
-- apply exactly as they would to any other write. The explicit has_role
-- check below is defense in depth in case those policies are ever loosened.

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
  _existing_product_id uuid;
  _normalized_code text;
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
      parsed_price_usd numeric,
      quality text,
      quality_reason text,
      action text,
      target_product_id uuid
    )
  loop
    if _row.action = 'skip' or _row.action is null then
      insert into public.pdf_import_rows
        (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, target_product_id, result, result_message)
      values
        (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'warning'), _row.quality_reason, 'skip', null, 'skipped', null);
      _skipped := _skipped + 1;

    elsif _row.action = 'create' then
      if _row.parsed_code is null or trim(_row.parsed_code) = '' or _row.parsed_name is null or trim(_row.parsed_name) = '' or _row.parsed_price_usd is null then
        insert into public.pdf_import_rows
          (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, result, result_message)
        values
          (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'error'), _row.quality_reason, 'create', 'failed', 'Code, Name und Preis werden für eine Neuanlage benötigt.');
        _failed := _failed + 1;
      else
        _normalized_code := upper(trim(_row.parsed_code));
        if exists (select 1 from public.products where code = _normalized_code) then
          insert into public.pdf_import_rows
            (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, result, result_message)
          values
            (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'error'), _row.quality_reason, 'create', 'failed', 'Artikelcode existiert bereits - bitte stattdessen "Aktualisieren" wählen.');
          _failed := _failed + 1;
        else
          insert into public.products (code, name, price_usd, is_active)
          values (_normalized_code, _row.parsed_name, _row.parsed_price_usd, true)
          returning id into _existing_product_id;

          insert into public.pdf_import_rows
            (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, target_product_id, result)
          values
            (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'ok'), _row.quality_reason, 'create', _existing_product_id, 'created');
          _created := _created + 1;
        end if;
      end if;

    elsif _row.action = 'update' then
      if _row.target_product_id is null then
        insert into public.pdf_import_rows
          (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, result, result_message)
        values
          (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'error'), _row.quality_reason, 'update', 'failed', 'Kein Zielprodukt für die Aktualisierung ausgewählt.');
        _failed := _failed + 1;
      elsif not exists (select 1 from public.products where id = _row.target_product_id) then
        insert into public.pdf_import_rows
          (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, target_product_id, result, result_message)
        values
          (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'error'), _row.quality_reason, 'update', _row.target_product_id, 'failed', 'Zielprodukt wurde nicht gefunden (evtl. inzwischen gelöscht).');
        _failed := _failed + 1;
      else
        update public.products
        set
          name = coalesce(nullif(trim(_row.parsed_name), ''), name),
          price_usd = coalesce(_row.parsed_price_usd, price_usd)
        where id = _row.target_product_id;

        insert into public.pdf_import_rows
          (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, target_product_id, result)
        values
          (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'ok'), _row.quality_reason, 'update', _row.target_product_id, 'updated');
        _updated := _updated + 1;
      end if;
    else
      insert into public.pdf_import_rows
        (import_id, row_number, raw_text, parsed_code, parsed_name, parsed_price_usd, quality, quality_reason, action, result, result_message)
      values
        (_import_id, _row.row_number, _row.raw_text, _row.parsed_code, _row.parsed_name, _row.parsed_price_usd, coalesce(_row.quality, 'error'), _row.quality_reason, null, 'failed', 'Unbekannte Aktion.');
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
  'Applies a reviewed PDF/CSV import batch (rows already decided by an admin in the UI) as one transaction. See docs/KONZEPT.md for the snapshot/import strategy.';

-- Only authenticated users may even attempt to call it; the has_role check
-- inside enforces admin-only behaviour.
revoke all on function public.apply_pdf_import(text, text, integer, boolean, jsonb) from public;
grant execute on function public.apply_pdf_import(text, text, integer, boolean, jsonb) to authenticated;
