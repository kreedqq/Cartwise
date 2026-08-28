-- 0024_research_identity_and_product_mapping.sql
-- Phase 1 research persistence: substance identity + product mapping only.
-- Does not alter products columns, prices, carts, or orders.
-- Does not store evidence, sources, studies, claims, or community reports.

-- ---------------------------------------------------------------------------
-- substances
-- ---------------------------------------------------------------------------

create table public.substances (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null check (char_length(trim(name)) >= 1),
  display_name text not null check (char_length(trim(display_name)) >= 1),
  category text not null,
  molecule_type text,
  chemical_class text,
  cas_number text,
  description text,
  identity_note text,
  -- Identity lifecycle. Not evidence A–F (that belongs in evidence_assessments later).
  status text not null default 'active'
    check (status in ('active', 'deprecated', 'merged', 'placeholder', 'blend')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint substances_slug_format check (slug = lower(trim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table public.substances is
  'Scientific substance identity. Independent of shop products. status is lifecycle, not evidence level.';
comment on column public.substances.status is
  'active | deprecated | merged | placeholder | blend. Never A–F evidence.';

create unique index substances_slug_key on public.substances (slug);
create index substances_status_idx on public.substances (status);
create index substances_category_idx on public.substances (category);

create trigger substances_set_updated_at
  before update on public.substances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- substance_aliases
-- ---------------------------------------------------------------------------

create table public.substance_aliases (
  id uuid primary key default gen_random_uuid(),
  substance_id uuid not null references public.substances (id) on delete cascade,
  alias text not null check (char_length(trim(alias)) >= 1),
  alias_type text not null
    check (alias_type in (
      'common_name',
      'development_name',
      'abbreviation',
      'chemical_name',
      'brand_name',
      'other'
    )),
  created_at timestamptz not null default now()
);

comment on table public.substance_aliases is
  'Confirmed aliases for a substance. TB-500 and Thymosin Beta-4 must remain separate rows.';

create unique index substance_aliases_per_substance_normalized_key
  on public.substance_aliases (substance_id, lower(trim(alias)));

-- Global uniqueness so one alias cannot silently attach two identities.
create unique index substance_aliases_normalized_alias_key
  on public.substance_aliases (lower(trim(alias)));

create index substance_aliases_substance_id_idx
  on public.substance_aliases (substance_id);

-- ---------------------------------------------------------------------------
-- substance_components (blends)
-- ---------------------------------------------------------------------------

create table public.substance_components (
  id uuid primary key default gen_random_uuid(),
  blend_id uuid not null references public.substances (id) on delete cascade,
  component_id uuid not null references public.substances (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint substance_components_no_self check (blend_id <> component_id),
  constraint substance_components_pair unique (blend_id, component_id)
);

comment on table public.substance_components is
  'Blend → component substances. A blend is not a unique INN.';

create index substance_components_component_id_idx
  on public.substance_components (component_id);

-- ---------------------------------------------------------------------------
-- product_substances (shop SKU → substance, no price copy)
-- ---------------------------------------------------------------------------

create table public.product_substances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  substance_id uuid not null references public.substances (id) on delete restrict,
  mapping_method text not null
    check (mapping_method in ('prefix', 'name', 'manual')),
  created_at timestamptz not null default now(),
  constraint product_substances_pair unique (product_id, substance_id)
);

comment on table public.product_substances is
  'Maps shop products to scientific substances without copying SKU, price, or availability.';

create index product_substances_substance_id_idx
  on public.product_substances (substance_id);

-- ---------------------------------------------------------------------------
-- RLS: authenticated read; admin write. No anon writes.
-- ---------------------------------------------------------------------------

alter table public.substances enable row level security;
alter table public.substance_aliases enable row level security;
alter table public.substance_components enable row level security;
alter table public.product_substances enable row level security;

create policy "substances_select_authenticated"
  on public.substances for select
  to authenticated
  using (auth.uid() is not null);

create policy "substances_write_admin"
  on public.substances for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substances_update_admin"
  on public.substances for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substances_delete_admin"
  on public.substances for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "substance_aliases_select_authenticated"
  on public.substance_aliases for select
  to authenticated
  using (auth.uid() is not null);

create policy "substance_aliases_write_admin"
  on public.substance_aliases for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substance_aliases_update_admin"
  on public.substance_aliases for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substance_aliases_delete_admin"
  on public.substance_aliases for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "substance_components_select_authenticated"
  on public.substance_components for select
  to authenticated
  using (auth.uid() is not null);

create policy "substance_components_write_admin"
  on public.substance_components for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substance_components_update_admin"
  on public.substance_components for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "substance_components_delete_admin"
  on public.substance_components for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "product_substances_select_authenticated"
  on public.product_substances for select
  to authenticated
  using (auth.uid() is not null);

create policy "product_substances_write_admin"
  on public.product_substances for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "product_substances_update_admin"
  on public.product_substances for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "product_substances_delete_admin"
  on public.product_substances for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Explicit grants (default privileges from 0015 also apply to new tables).
grant select, insert, update, delete on public.substances to authenticated;
grant select, insert, update, delete on public.substance_aliases to authenticated;
grant select, insert, update, delete on public.substance_components to authenticated;
grant select, insert, update, delete on public.product_substances to authenticated;
grant select, insert, update, delete on public.substances to service_role;
grant select, insert, update, delete on public.substance_aliases to service_role;
grant select, insert, update, delete on public.substance_components to service_role;
grant select, insert, update, delete on public.product_substances to service_role;

-- ---------------------------------------------------------------------------
-- Identity seed from src/lib/peptide/catalog.ts (identity catalog only).
-- CAS / chemical_class stay null: published.json overlay is not imported.
-- ---------------------------------------------------------------------------

insert into public.substances (
  slug, name, display_name, category, molecule_type, description, identity_note, status
) values
  ('retatrutide', 'Retatrutide', 'Retatrutide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('tirzepatide', 'Tirzepatide', 'Tirzepatide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('semaglutide', 'Semaglutide', 'Semaglutide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('liraglutide', 'Liraglutide', 'Liraglutide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('cagrilintide', 'Cagrilintide', 'Cagrilintide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('mazdutide', 'Mazdutide', 'Mazdutide', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('orforglipron', 'Orforglipron', 'Orforglipron', 'glp-metabolic', 'small-molecule',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('tesamorelin', 'Tesamorelin', 'Tesamorelin', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('cjc-1295', 'CJC-1295', 'CJC-1295', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('ipamorelin', 'Ipamorelin', 'Ipamorelin', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('sermorelin', 'Sermorelin', 'Sermorelin', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('ghk-cu', 'GHK-Cu', 'GHK-Cu', 'cosmetic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('bpc-157', 'BPC-157', 'BPC-157', 'recovery', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('tb-500', 'TB-500', 'TB-500', 'recovery', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    $n$TB-500 wird nicht automatisch mit vollständigem Thymosin Beta-4 gleichgesetzt. Die Identität bleibt getrennt, bis eine geprüfte Quelle die Zuordnung bestätigt.$n$,
    'active'),
  ('thymosin-beta-4', 'Thymosin Beta-4', 'Thymosin Beta-4', 'recovery', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    $n$Vollständiges Thymosin Beta-4. Nicht automatisch identisch mit TB-500.$n$,
    'active'),
  ('mots-c', 'MOTS-C', 'MOTS-C', 'longevity', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('aod-9604', 'AOD-9604', 'AOD-9604', 'glp-metabolic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('semax', 'Semax', 'Semax', 'cognitive', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('selank', 'Selank', 'Selank', 'cognitive', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('thymosin-alpha-1', 'Thymosin Alpha-1', 'Thymosin Alpha-1', 'immune', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('kpv', 'KPV', 'KPV', 'immune', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('igf-1-lr3', 'IGF-1 LR3', 'IGF-1 LR3', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    $n$IGF-1 LR3 (Long R3 IGF-1) wird nicht automatisch mit rhIGF-1/Mecasermin (Increlex) gleichgesetzt.$n$,
    'active'),
  ('somatropin', 'Somatropin', 'Somatropin', 'growth-hormone', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('hcg', 'Human Chorionic Gonadotropin', 'Human Chorionic Gonadotropin', 'hormones', 'biologics',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('gonadorelin', 'Gonadorelin', 'Gonadorelin', 'hormones', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'active'),
  ('melanotan-ii', 'Melanotan II', 'Melanotan II', 'cosmetic', 'peptide',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    $n$Melanotan II wird nicht automatisch mit Afamelanotid (Scenesse, NDP-MSH) gleichgesetzt.$n$,
    'active'),
  ('glow-blend', 'GHK-Cu + TB-500 + BPC-157', 'GHK-Cu + TB-500 + BPC-157', 'recovery', 'blend',
    'Identitätsdatensatz für Suche und Zuordnung. Wissenschaftliche Aussagen erscheinen erst nach geprüften Quellen.',
    null, 'blend');

insert into public.substance_aliases (substance_id, alias, alias_type)
select s.id, v.alias, v.alias_type
from public.substances s
join (
  values
    ('retatrutide', 'Reta', 'common_name'),
    ('retatrutide', 'Retatrutid', 'common_name'),
    ('retatrutide', 'LY3437943', 'development_name'),
    ('tirzepatide', 'Tirzepatid', 'common_name'),
    ('tirzepatide', 'TZP', 'common_name'),
    ('tirzepatide', 'LY3298176', 'development_name'),
    ('semaglutide', 'Semaglutid', 'common_name'),
    ('liraglutide', 'Liraglutid', 'common_name'),
    ('mazdutide', 'IBI362', 'development_name'),
    ('mazdutide', 'LY3305677', 'development_name'),
    ('orforglipron', 'LY3502970', 'development_name'),
    ('cjc-1295', 'CJC1295', 'common_name'),
    ('cjc-1295', 'CJC 1295', 'common_name'),
    ('ipamorelin', 'IPA', 'common_name'),
    ('sermorelin', 'Geref', 'common_name'),
    ('sermorelin', 'GRF 1-29', 'common_name'),
    ('ghk-cu', 'GHK', 'common_name'),
    ('ghk-cu', 'Copper peptide', 'common_name'),
    ('bpc-157', 'BPC157', 'common_name'),
    ('bpc-157', 'Body Protection Compound 157', 'common_name'),
    ('tb-500', 'TB500', 'common_name'),
    ('thymosin-beta-4', 'Tβ4', 'common_name'),
    ('thymosin-beta-4', 'TMSB4', 'common_name'),
    ('mots-c', 'MOTS-c', 'common_name'),
    ('mots-c', 'MOTSC', 'common_name'),
    ('aod-9604', 'AOD9604', 'common_name'),
    ('semax', 'ACTH(4-10) analogue', 'common_name'),
    ('selank', 'tuftsin analogue', 'common_name'),
    ('thymosin-alpha-1', 'Tα1', 'common_name'),
    ('thymosin-alpha-1', 'Thymalfasin', 'common_name'),
    ('thymosin-alpha-1', 'Zadaxin', 'common_name'),
    ('kpv', 'Lys-Pro-Val', 'common_name'),
    ('kpv', 'alpha-MSH fragment', 'common_name'),
    ('igf-1-lr3', 'IGF1 LR3', 'common_name'),
    ('igf-1-lr3', 'Long R3 IGF-1', 'common_name'),
    ('somatropin', 'HGH', 'common_name'),
    ('somatropin', 'rhGH', 'common_name'),
    ('hcg', 'HCG', 'common_name'),
    ('hcg', 'chorionic gonadotropin', 'common_name'),
    ('gonadorelin', 'GnRH', 'common_name'),
    ('gonadorelin', 'Factrel', 'common_name'),
    ('melanotan-ii', 'MT-2', 'common_name'),
    ('melanotan-ii', 'MT2', 'common_name'),
    ('melanotan-ii', 'Melanotan', 'common_name'),
    ('glow-blend', 'GLOW', 'common_name'),
    ('glow-blend', 'Glow Blend', 'common_name')
) as v(slug, alias, alias_type) on v.slug = s.slug;

insert into public.substance_components (blend_id, component_id, sort_order)
select b.id, c.id, v.sort_order
from (
  values
    ('glow-blend', 'ghk-cu', 1),
    ('glow-blend', 'tb-500', 2),
    ('glow-blend', 'bpc-157', 3)
) as v(blend_slug, component_slug, sort_order)
join public.substances b on b.slug = v.blend_slug
join public.substances c on c.slug = v.component_slug;

-- ---------------------------------------------------------------------------
-- Prefix/name mapping from existing products (no invented SKUs).
-- Mirrors src/lib/peptide/search.ts CODE_PREFIX + glow-blend name rule.
-- Fuzzy name fallback in the client is NOT copied here (ambiguous).
-- ---------------------------------------------------------------------------

create or replace function public.refresh_product_substance_prefix_mappings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Nur Admins dürfen Product-Substance-Mappings aktualisieren.' using errcode = '42501';
  end if;

  insert into public.product_substances (product_id, substance_id, mapping_method)
  select p.id, s.id, 'prefix'
  from public.products p
  join public.substances s on s.slug = case
    when p.code ~* '^RT[0-9]' then 'retatrutide'
    when p.code ~* '^TZ[0-9]' then 'tirzepatide'
    when p.code ~* '^SM[0-9]' then 'semaglutide'
    when p.code ~* '^LR[0-9]' then 'liraglutide'
    when p.code ~* '^CJC' then 'cjc-1295'
    when p.code ~* '^IPA' then 'ipamorelin'
    when p.code ~* '^BPC' then 'bpc-157'
    when p.code ~* '^TB5' then 'tb-500'
    when p.code ~* '^GHK' then 'ghk-cu'
    when p.code ~* '^MOT' then 'mots-c'
    when p.code ~* '^AOD' then 'aod-9604'
    when p.code ~* '^MT2' then 'melanotan-ii'
    when p.code ~* '^MT[0-9]' then 'melanotan-ii'
    when p.code ~* '^KPV' then 'kpv'
    when p.code ~* '^IGF' then 'igf-1-lr3'
    else null
  end
  on conflict (product_id, substance_id) do nothing;

  get diagnostics inserted = row_count;

  insert into public.product_substances (product_id, substance_id, mapping_method)
  select p.id, s.id, 'name'
  from public.products p
  join public.substances s on s.slug = 'glow-blend'
  where lower(p.name) like '%ghk%'
    and lower(p.name) like '%tb%'
    and lower(p.name) like '%bpc%'
    and not exists (
      select 1 from public.product_substances ps where ps.product_id = p.id
    )
  on conflict (product_id, substance_id) do nothing;

  return inserted;
end;
$$;

comment on function public.refresh_product_substance_prefix_mappings() is
  'Admin/service-role: insert product_substances rows from known catalog prefixes. Does not invent SKUs.';

grant execute on function public.refresh_product_substance_prefix_mappings() to authenticated;
grant execute on function public.refresh_product_substance_prefix_mappings() to service_role;

select public.refresh_product_substance_prefix_mappings();
