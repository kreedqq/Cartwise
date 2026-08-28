-- 0027_research_regulatory_and_review.sql
-- Phase 4: regulatory_records, regulatory_history, review_actions.
-- Imports published.json regulatory sources only. No community. No lexicon switch.
-- Does not change Phase 3 evidence assessment statuses.

create table public.regulatory_records (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null,
  substance_id uuid not null references public.substances (id) on delete restrict,
  authority text not null
    check (authority in ('fda', 'ema', 'bfarm', 'mhra', 'nmpa', 'other')),
  region text not null
    check (region in ('US', 'EU', 'UK', 'JP', 'CN', 'unspecified')),
  status text not null
    check (status in (
      'approved',
      'approved_specific_indication',
      'clinical_development',
      'investigational',
      'not_approved',
      'insufficient_information',
      'unknown'
    )),
  indication text,
  product_name text,
  application_id text,
  source_id uuid not null references public.sources (id) on delete restrict,
  effective_date text,
  last_checked text,
  is_current boolean not null default true,
  note text,
  review_status text not null
    check (review_status in ('draft', 'review-required', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.regulatory_records is
  'Regional regulatory state for a substance. Empty FDA/EMA search is never stored as not_approved.';
comment on column public.regulatory_records.is_current is
  'false for related/non-identical products (e.g. Ovitrelle vs urinary hCG).';

create unique index regulatory_records_stable_key_key on public.regulatory_records (stable_key);
create unique index regulatory_records_substance_source_key on public.regulatory_records (substance_id, source_id);
create index regulatory_records_substance_region_idx on public.regulatory_records (substance_id, region);
create index regulatory_records_authority_idx on public.regulatory_records (authority);
create index regulatory_records_status_idx on public.regulatory_records (status);
create index regulatory_records_source_id_idx on public.regulatory_records (source_id);
create index regulatory_records_current_idx on public.regulatory_records (is_current) where is_current;

create trigger regulatory_records_set_updated_at
  before update on public.regulatory_records
  for each row execute function public.set_updated_at();

create table public.regulatory_history (
  id uuid primary key default gen_random_uuid(),
  regulatory_record_id uuid not null references public.regulatory_records (id) on delete restrict,
  old_status text,
  new_status text,
  old_indication text,
  new_indication text,
  source_id uuid references public.sources (id) on delete restrict,
  changed_at timestamptz not null default now(),
  reason text
);

comment on table public.regulatory_history is
  'Append-only status/indication changes. Import has no invented transitions.';

create index regulatory_history_record_idx on public.regulatory_history (regulatory_record_id, changed_at);

create or replace function public.regulatory_records_write_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    old.status is distinct from new.status
    or old.indication is distinct from new.indication
    or old.is_current is distinct from new.is_current
  ) then
    insert into public.regulatory_history (
      regulatory_record_id, old_status, new_status, old_indication, new_indication, source_id, reason
    ) values (
      new.id, old.status, new.status, old.indication, new.indication, new.source_id, 'regulatory_records update'
    );
  end if;
  return new;
end;
$$;

create trigger regulatory_records_history
  after update on public.regulatory_records
  for each row execute function public.regulatory_records_write_history();

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type in (
      'claim', 'evidence_assessment', 'regulatory_record', 'research_update', 'substance'
    )),
  entity_id uuid,
  entity_stable_key text,
  action text not null
    check (action in ('approve', 'reject', 'request_review', 'edit', 'publish', 'unpublish')),
  previous_status text,
  new_status text,
  reason text,
  admin_user_id uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.review_actions is
  'Append-only research review trail. No UPDATE/DELETE for clients. Uses existing admin users (auth.users).';

create index review_actions_entity_idx on public.review_actions (entity_type, entity_stable_key, created_at);
create index review_actions_admin_idx on public.review_actions (admin_user_id, created_at);
create index review_actions_created_at_idx on public.review_actions (created_at);

alter table public.regulatory_records enable row level security;
alter table public.regulatory_history enable row level security;
alter table public.review_actions enable row level security;

create policy "regulatory_records_select_authenticated"
  on public.regulatory_records for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or (is_current and review_status = 'approved')
    )
  );

create policy "regulatory_records_write_admin"
  on public.regulatory_records for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "regulatory_records_update_admin"
  on public.regulatory_records for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "regulatory_records_delete_admin"
  on public.regulatory_records for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "regulatory_history_select_authenticated"
  on public.regulatory_history for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1
      from public.regulatory_records r
      where r.id = regulatory_record_id
        and r.is_current
        and r.review_status = 'approved'
    )
  );

create policy "regulatory_history_insert_admin"
  on public.regulatory_history for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "review_actions_select_admin"
  on public.review_actions for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "review_actions_insert_admin"
  on public.review_actions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.regulatory_records to authenticated;
grant select, insert on public.regulatory_history to authenticated;
grant select, insert on public.review_actions to authenticated;
grant select, insert, update, delete on public.regulatory_records to service_role;
grant select, insert, update, delete on public.regulatory_history to service_role;
grant select, insert on public.review_actions to service_role;

grant execute on function public.regulatory_records_write_history() to authenticated;
grant execute on function public.regulatory_records_write_history() to service_role;

-- BEGIN GENERATED SEED
insert into public.regulatory_records (
  stable_key, substance_id, authority, region, status, indication, product_name,
  application_id, source_id, effective_date, last_checked, is_current, note, review_status
)
select
  x.stable_key,
  sub.id,
  x.authority,
  x.region,
  x.status,
  x.indication,
  x.product_name,
  x.application_id,
  src.id,
  x.effective_date,
  x.last_checked,
  x.is_current,
  x.note,
  x.review_status
from jsonb_to_recordset($phase4_regulatory$
[{"stable_key":"retatrutide:fda-none-retatrutide","substance_slug":"retatrutide","authority":"fda","region":"US","status":"clinical_development","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-retatrutide","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"tirzepatide:fda-mounjaro","substance_slug":"tirzepatide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"MOUNJARO (TIRZEPATIDE)","application_id":"NDA215866","legacy_source_id":"fda-mounjaro","effective_date":"20260729","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"tirzepatide:fda-zepbound","substance_slug":"tirzepatide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Zepbound (TIRZEPATIDE)","application_id":"NDA217806","legacy_source_id":"fda-zepbound","effective_date":"20260422","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"tirzepatide:ema-mounjaro","substance_slug":"tirzepatide","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Mounjaro","application_id":"NDA215866","legacy_source_id":"ema-mounjaro","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"semaglutide:fda-semaglutide-27f15fac","substance_slug":"semaglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"OZEMPIC (ORAL SEMAGLUTIDE)","application_id":"NDA213051","legacy_source_id":"fda-semaglutide-27f15fac","effective_date":"20260130","last_checked":"2026-08-28","is_current":true,"note":"DailyMed title says OZEMPIC (ORAL SEMAGLUTIDE); identityNote lists oral tablets as NDA213051. Not treated as a second current Ozempic s.c. NDA.","review_status":"review-required"},{"stable_key":"semaglutide:fda-ozempic","substance_slug":"semaglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Ozempic (SEMAGLUTIDE)","application_id":"NDA209637","legacy_source_id":"fda-ozempic","effective_date":"20260730","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"semaglutide:fda-semaglutide-979e4df4","substance_slug":"semaglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Ozempic (SEMAGLUTIDE)","application_id":"NDA209637","legacy_source_id":"fda-semaglutide-979e4df4","effective_date":"20231122","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"semaglutide:ema-ozempic","substance_slug":"semaglutide","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Ozempic","application_id":null,"legacy_source_id":"ema-ozempic","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"semaglutide:ema-wegovy","substance_slug":"semaglutide","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Wegovy","application_id":null,"legacy_source_id":"ema-wegovy","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"liraglutide:fda-liraglutide-0450d8a2","substance_slug":"liraglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Liraglutide (LIRAGLUTIDE)","application_id":null,"legacy_source_id":"fda-liraglutide-0450d8a2","effective_date":"20251113","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"liraglutide:fda-liraglutide-wt","substance_slug":"liraglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Liraglutide (LIRAGLUTIDE)","application_id":null,"legacy_source_id":"fda-liraglutide-wt","effective_date":"20251016","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"liraglutide:fda-liraglutide-t2d","substance_slug":"liraglutide","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Liraglutide (LIRAGLUTIDE)","application_id":null,"legacy_source_id":"fda-liraglutide-t2d","effective_date":"20250130","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"liraglutide:ema-victoza","substance_slug":"liraglutide","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Victoza","application_id":null,"legacy_source_id":"ema-victoza","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"liraglutide:ema-saxenda","substance_slug":"liraglutide","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Saxenda","application_id":null,"legacy_source_id":"ema-saxenda","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"cagrilintide:fda-none-cagrilintide","substance_slug":"cagrilintide","authority":"fda","region":"US","status":"clinical_development","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-cagrilintide","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"mazdutide:fda-none-mazdutide","substance_slug":"mazdutide","authority":"fda","region":"US","status":"clinical_development","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-mazdutide","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"orforglipron:fda-foundayo","substance_slug":"orforglipron","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"FOUNDAYO (ORFORGLIPRON)","application_id":"NDA220934","legacy_source_id":"fda-foundayo","effective_date":"20260729","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"tesamorelin:fda-egrifta","substance_slug":"tesamorelin","authority":"fda","region":"US","status":"approved_specific_indication","indication":"Reduktion überschüssigen Abdominalfetts bei HIV-infizierten Erwachsenen mit Lipodystrophie — nicht als allgemeines Gewichtsmanagement.","product_name":"EGRIFTA SV (TESAMORELIN)","application_id":"BLA022505","legacy_source_id":"fda-egrifta","effective_date":"20260729","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"cjc-1295:fda-none-cjc-1295","substance_slug":"cjc-1295","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-cjc-1295","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"ipamorelin:fda-none-ipamorelin","substance_slug":"ipamorelin","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-ipamorelin","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"bpc-157:fda-none-bpc-157","substance_slug":"bpc-157","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-bpc-157","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"tb-500:fda-none-tb-500","substance_slug":"tb-500","authority":"fda","region":"US","status":"insufficient_information","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-tb-500","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"ghk-cu:fda-none-ghk-cu","substance_slug":"ghk-cu","authority":"fda","region":"US","status":"insufficient_information","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-ghk-cu","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"mots-c:fda-none-mots-c","substance_slug":"mots-c","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-mots-c","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"aod-9604:fda-none-aod-9604","substance_slug":"aod-9604","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-aod-9604","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"sermorelin:fda-none-sermorelin","substance_slug":"sermorelin","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-sermorelin","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"thymosin-beta-4:fda-none-thymosin-beta-4","substance_slug":"thymosin-beta-4","authority":"fda","region":"US","status":"clinical_development","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-thymosin-beta-4","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"semax:fda-none-semax","substance_slug":"semax","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-semax","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"selank:fda-none-selank","substance_slug":"selank","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-selank","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"thymosin-alpha-1:fda-none-thymosin-alpha-1","substance_slug":"thymosin-alpha-1","authority":"fda","region":"US","status":"clinical_development","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-thymosin-alpha-1","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"kpv:fda-none-kpv","substance_slug":"kpv","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-kpv","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"igf-1-lr3:fda-none-igf-1-lr3","substance_slug":"igf-1-lr3","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-igf-1-lr3","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"somatropin:fda-norditropin","substance_slug":"somatropin","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Norditropin (SOMATROPIN)","application_id":"BLA021148","legacy_source_id":"fda-norditropin","effective_date":"20250707","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"somatropin:fda-omnitrope","substance_slug":"somatropin","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Omnitrope (SOMATROPIN)","application_id":null,"legacy_source_id":"fda-omnitrope","effective_date":"20250710","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"somatropin:fda-serostim","substance_slug":"somatropin","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Serostim (SOMATROPIN)","application_id":null,"legacy_source_id":"fda-serostim","effective_date":"20260728","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"somatropin:ema-omnitrope","substance_slug":"somatropin","authority":"ema","region":"EU","status":"approved_specific_indication","indication":null,"product_name":"Omnitrope","application_id":null,"legacy_source_id":"ema-omnitrope","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"hcg:fda-hcg","substance_slug":"hcg","authority":"fda","region":"US","status":"approved_specific_indication","indication":null,"product_name":"Chorionic Gonadotropin (CHORIONIC GONADOTROPIN)","application_id":"BLA017067","legacy_source_id":"fda-hcg","effective_date":"20250325","last_checked":"2026-08-28","is_current":true,"note":null,"review_status":"approved"},{"stable_key":"hcg:ema-ovitrelle","substance_slug":"hcg","authority":"ema","region":"EU","status":"unknown","indication":null,"product_name":"Ovitrelle","application_id":null,"legacy_source_id":"ema-ovitrelle","effective_date":null,"last_checked":"2026-08-28","is_current":false,"note":"Related recombinant choriogonadotropin alfa (Ovitrelle), not urinary hCG. Not stored as a current EU approval for the urinary hCG substance.","review_status":"review-required"},{"stable_key":"gonadorelin:fda-none-gonadorelin","substance_slug":"gonadorelin","authority":"fda","region":"US","status":"insufficient_information","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-gonadorelin","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"melanotan-ii:fda-none-melanotan-ii","substance_slug":"melanotan-ii","authority":"fda","region":"US","status":"investigational","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-melanotan-ii","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"},{"stable_key":"glow-blend:fda-none-glow-blend","substance_slug":"glow-blend","authority":"fda","region":"US","status":"insufficient_information","indication":null,"product_name":null,"application_id":null,"legacy_source_id":"fda-none-glow-blend","effective_date":null,"last_checked":"2026-08-28","is_current":true,"note":"openFDA/label search found no product match; that is not stored as not_approved.","review_status":"approved"}]
$phase4_regulatory$::jsonb) as x(
  stable_key text,
  substance_slug text,
  authority text,
  region text,
  status text,
  indication text,
  product_name text,
  application_id text,
  legacy_source_id text,
  effective_date text,
  last_checked text,
  is_current boolean,
  note text,
  review_status text
)
join public.substances sub on sub.slug = x.substance_slug
join public.sources src on src.legacy_ids @> array[x.legacy_source_id];

insert into public.review_actions (
  entity_type, entity_id, entity_stable_key, action, previous_status, new_status, reason
)
select
  x.entity_type,
  sub.id,
  x.entity_stable_key,
  x.action,
  x.previous_status,
  x.new_status,
  x.reason
from jsonb_to_recordset($phase4_review_actions$
[{"entity_type":"substance","entity_stable_key":"retatrutide","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Medium] Phase-3-Recency vs. fehlende Zulassung: Phase-3-Programme und eine TRANSCEND-T2D-1-Publikation existieren. Eine FDA-/EMA-Zulassung war in den geprüften Behördquellen nicht nachweisbar. Status bleibt klinische Entwicklung, nicht zugelassen."},{"entity_type":"substance","entity_stable_key":"cagrilintide","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Medium] Evidence C vs. mögliche B: Humane randomisierte Daten und Phase-3-Registrierungen existieren. Ohne abgeschlossenes Zulassungsprogramm bleibt Evidence C; ein Upgrade auf B wäre nach Review weiterer Phase-3-Publikationen zu prüfen."},{"entity_type":"substance","entity_stable_key":"mazdutide","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] Möglicher China-NMPA-Status ohne primäre Behördquelle: PMID 41028652 (Drugs, First Approval) berichtet eine NMPA-Zulassung in China. Das ist eine wissenschaftliche Sekundärquelle, keine NMPA-Primärquelle. Regulatory bleibt clinical-development, nicht global approved."},{"entity_type":"substance","entity_stable_key":"orforglipron","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] EMA-/Nicht-US-Zulassungsstatus: FDA-Label FOUNDAYO (NDA220934, US) ist die belastbare Zulassungsquelle. EMA/BfArM/MHRA wurden für FOUNDAYO in diesem Batch nicht als EPAR/Behördquelle geprüft. Kein globales Approved."},{"entity_type":"substance","entity_stable_key":"tb-500","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] Fiktive CT.gov-Registrierung NCT07487363: ClinicalTrials.gov Brief Summary von NCT07487363 beginnt mit „This fictional study is an example of a ClinicalTrials.gov-style record.“ Sponsor Hudson Biotech. Der Record bleibt im Rohcache, wird aber nicht als Studie oder Human-Evidenz veröffentlicht."},{"entity_type":"substance","entity_stable_key":"ghk-cu","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[Medium] NCT07706361 misst GHK-Spiegel, gibt kein GHK-Cu: Die Registrierung untersucht ein X39-Patch und zirkulierende GHK/GHK-Cu-Spiegel. Das ist keine Interventionsstudie mit GHK-Cu-Peptidgabe und wird nicht als solche veröffentlicht."},{"entity_type":"substance","entity_stable_key":"mots-c","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] Hudson-Biotech-Registrierung NCT07505745: NCT07505745 hat denselben Sponsor und dieselbe Kontakt-/Standortsignatur wie NCT07487363, dessen Brief Summary sich als fiktives Beispielrecord ausweist. Ohne unabhängige Bestätigung nicht als Humanstudie werten."},{"entity_type":"substance","entity_stable_key":"aod-9604","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Low] 0 CT.gov-Treffer ist kein Beweis für fehlende Humanstudien: Die Abfrage AOD9604 lieferte 0 ClinicalTrials.gov-Treffer. Ältere Literatur kann Humanstudien außerhalb dieses Terms enthalten. Evidence E bleibt, bis weitere belastbare Humanquellen kuratiert sind."},{"entity_type":"substance","entity_stable_key":"sermorelin","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Medium] Historische Geref-Zulassung vs. aktueller Drugs@FDA-Leerstand: Die Identität Geref/GRF 1-29 ist katalogisiert. openFDA lieferte am 28.08.2026 keinen Produktmatch. Das ist kein Nachweis „never approved“. Historische Labels wurden in diesem Batch nicht als DailyMed-Set rekonstruiert."},{"entity_type":"substance","entity_stable_key":"thymosin-beta-4","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[High] RGN-259 und TB-500 nicht mit Thymosin Beta-4-Vials vermengen: RGN-259-Studien (z. B. NCT05555589) untersuchen eine ophthalmologische Formulierung. TB-500 bleibt ein getrennter Identity-Record. NCT07487363 ist Hudson Biotech und wird nicht veröffentlicht."},{"entity_type":"substance","entity_stable_key":"semax","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Medium] 0 CT.gov-Treffer ≠ keine Humanforschung: Die Abfrage semax lieferte 0 ClinicalTrials.gov-Treffer. PMID 29798983 und weitere titelgeprüfte PubMed-Einträge belegen Humanliteratur außerhalb dieses Registers."},{"entity_type":"substance","entity_stable_key":"selank","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[High] CT.gov-Treffer ohne Selank im Titel: 10 ClinicalTrials.gov-Hits zum Term selank betrafen in den gecachten Titeln andere kognitive/neurologische Interventionen. Sie werden nicht veröffentlicht. 10 Noise-Hits ≠ 10 Selank-Studien."},{"entity_type":"substance","entity_stable_key":"thymosin-alpha-1","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] Zadaxin/Thymalfasin außerhalb Drugs@FDA: Alias Zadaxin ist katalogisiert. openFDA/thymalfasin war am 28.08.2026 ohne Match. Ohne EMA/NMPA/andere Primärquelle kein regionales Approved. Status bleibt klinische Entwicklung / insufficient für US-Label."},{"entity_type":"substance","entity_stable_key":"igf-1-lr3","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[High] Nicht mit Mecasermin/Increlex zusammenführen: 0 CT.gov- und 0 FDA-Treffer für IGF-1 LR3. rhIGF-1-Zulassungen gelten nicht automatisch für Long R3. PMID 22227200 (Schaf) bleibt ausgeschlossen."},{"entity_type":"substance","entity_stable_key":"somatropin","action":"request_review","previous_status":null,"new_status":"fresh","reason":"[Low] Norditropin-EPAR-URL 404: https://www.ema.europa.eu/en/medicines/human/EPAR/norditropin lieferte HTTP 404. EU-Region stützt sich in diesem Batch auf Omnitrope EPAR (200), nicht auf die fehlgeschlagene Norditropin-URL."},{"entity_type":"substance","entity_stable_key":"hcg","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[Medium] Ovitrelle nicht als urinäres hCG-Label werten: EU-EPAR Ovitrelle (HTTP 200) ist als verwandte rekombinante Quelle hinterlegt, erweitert aber nicht automatisch die US-Indikationen und setzt regulatoryRegions nicht auf EU für urinäres hCG."},{"entity_type":"substance","entity_stable_key":"gonadorelin","action":"request_review","previous_status":null,"new_status":"review-required","reason":"[High] CT.gov/PubMed-Rauschen und fehlende aktuelle Labels: Factrel/Lutrelef sind Identity-Aliase. FDA 404 und EMA lutrelef 404 sind keine globale Nicht-Zulassung. 1331 CT.gov-Treffer ohne „gonadorelin“ im Titel dürfen nicht als Studienlage gelten. Nächste Recherche: Title-restricted PubMed und alternative EPAR-Slugs."},{"entity_type":"substance","entity_stable_key":"melanotan-ii","action":"request_review","previous_status":null,"new_status":"review-recommended","reason":"[High] Hudson-NCT ausgeschlossen; nicht Afamelanotid: NCT07437560 ist Hudson Biotech und wird nicht veröffentlicht. Melanotan II bleibt von Afamelanotid/Scenesse getrennt. 1 ausgeschlossener CT.gov-Hit ≠ Nachweis fehlender weltweiter Humanforschung, zeigt aber kein valides Registerprogramm in diesem Scan."},{"entity_type":"substance","entity_stable_key":"glow-blend","action":"request_review","previous_status":null,"new_status":"fresh","reason":"[Low] Wissenschaft nur über Komponenten: Research Complete für den Blend bedeutet: Identity und Mapping geprüft, keine Pseudo-INN-Recherche. Neue wissenschaftliche Aussagen gehören in die drei Komponentenprofile."}]
$phase4_review_actions$::jsonb) as x(
  entity_type text,
  entity_stable_key text,
  action text,
  previous_status text,
  new_status text,
  reason text
)
join public.substances sub on sub.slug = x.entity_stable_key;
