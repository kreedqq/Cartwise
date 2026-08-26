-- 0006_pdf_imports.sql
-- PDF/CSV product import log: one row per import batch (pdf_imports) and one
-- row per detected/edited line (pdf_import_rows). Admin-only end to end.

create table public.pdf_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users (id) on delete set null,
  file_path text not null,
  file_name text not null,
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'previewed', 'applied', 'failed', 'cancelled')),
  has_text_layer boolean,
  summary_created integer not null default 0,
  summary_updated integer not null default 0,
  summary_skipped integer not null default 0,
  summary_failed integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pdf_imports is 'One row per PDF/CSV product import attempt (admin-only). File itself lives in the pdf-imports storage bucket.';

create trigger pdf_imports_set_updated_at
  before update on public.pdf_imports
  for each row execute function public.set_updated_at();

create index pdf_imports_uploaded_by_idx on public.pdf_imports (uploaded_by, created_at desc);

alter table public.pdf_imports enable row level security;

create policy "pdf_imports_admin_all"
  on public.pdf_imports for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------

create table public.pdf_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.pdf_imports (id) on delete cascade,
  row_number integer not null,
  raw_text text not null,
  parsed_code text,
  parsed_name text,
  parsed_price_usd numeric(12, 4),
  quality text not null default 'warning' check (quality in ('ok', 'warning', 'error')),
  quality_reason text,
  action text check (action in ('create', 'update', 'skip')),
  target_product_id uuid references public.products (id) on delete set null,
  result text check (result in ('created', 'updated', 'skipped', 'failed')),
  result_message text
);

comment on table public.pdf_import_rows is 'Per-line detail of a PDF/CSV import: raw text, parsed fields, admin decision, and outcome.';

create index pdf_import_rows_import_idx on public.pdf_import_rows (import_id, row_number);

alter table public.pdf_import_rows enable row level security;

create policy "pdf_import_rows_admin_all"
  on public.pdf_import_rows for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
