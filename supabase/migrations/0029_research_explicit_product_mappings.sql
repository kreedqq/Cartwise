-- 0029_research_explicit_product_mappings.sql
-- Phase 6B: explicit product_substances for live SKUs that uniquely match a substance.
-- Does not ALTER products, prices, carts, orders, or auth.
-- 0024 prefix/glow still runs first. This file adds manual rows and unmaps unsafe prefix hits.
-- Unresolved shop labels (BT*, MT1, blends, fragments) are not inserted.

insert into public.product_substances (product_id, substance_id, mapping_method)
select p.id, s.id, 'manual'
from (
  values
    ('TR5', 'tirzepatide'),
    ('TR10', 'tirzepatide'),
    ('TR15', 'tirzepatide'),
    ('TR20', 'tirzepatide'),
    ('TR30', 'tirzepatide'),
    ('TR40', 'tirzepatide'),
    ('TR50', 'tirzepatide'),
    ('TR60', 'tirzepatide'),
    ('TR100', 'tirzepatide'),
    ('TR120', 'tirzepatide'),
    ('TR500', 'tirzepatide'),
    ('SMO5', 'sermorelin'),
    ('SMO10', 'sermorelin'),
    ('SMO15', 'sermorelin'),
    ('TA5', 'thymosin-alpha-1'),
    ('TA10', 'thymosin-alpha-1'),
    ('ML10', 'melanotan-ii'),
    ('SMM3', 'semaglutide'),
    ('SMM7', 'semaglutide'),
    ('LL5', 'liraglutide'),
    ('LL10', 'liraglutide'),
    ('LL30', 'liraglutide'),
    ('IP2', 'ipamorelin'),
    ('IP5', 'ipamorelin'),
    ('IP10', 'ipamorelin'),
    ('CU50', 'ghk-cu'),
    ('CU100', 'ghk-cu'),
    ('ORF6', 'orforglipron'),
    ('ORF12', 'orforglipron'),
    ('GND2', 'gonadorelin'),
    ('TSM5', 'tesamorelin'),
    ('TSM10', 'tesamorelin'),
    ('TSM20', 'tesamorelin'),
    ('CGL5', 'cagrilintide'),
    ('CGL10', 'cagrilintide'),
    ('CGL20', 'cagrilintide'),
    ('MDT5', 'mazdutide'),
    ('MDT10', 'mazdutide'),
    ('SK5', 'selank'),
    ('SK10', 'selank'),
    ('SK30', 'selank'),
    ('XA5', 'semax'),
    ('XA10', 'semax'),
    ('XA30', 'semax'),
    ('MS10', 'mots-c'),
    ('MS40', 'mots-c'),
    ('KP5', 'kpv'),
    ('KP10', 'kpv'),
    ('KP500', 'kpv'),
    ('CD2', 'cjc-1295'),
    ('CD5', 'cjc-1295'),
    ('CD10', 'cjc-1295'),
    ('CND2', 'cjc-1295'),
    ('CND5', 'cjc-1295'),
    ('CND10', 'cjc-1295'),
    ('BC2', 'bpc-157'),
    ('BC5', 'bpc-157'),
    ('BC10', 'bpc-157'),
    ('BC20', 'bpc-157'),
    ('BC500', 'bpc-157'),
    ('B157', 'bpc-157'),
    ('2AD', 'aod-9604'),
    ('5AD', 'aod-9604'),
    ('10AD', 'aod-9604'),
    ('IG1', 'igf-1-lr3'),
    ('IG01', 'igf-1-lr3'),
    ('G2K', 'hcg'),
    ('G5K', 'hcg'),
    ('G10K', 'hcg'),
    ('H06', 'somatropin'),
    ('H10', 'somatropin'),
    ('H12', 'somatropin'),
    ('H15', 'somatropin'),
    ('H24', 'somatropin'),
    ('H36', 'somatropin'),
    ('H50', 'somatropin')
) as v(code, slug)
join public.products p on p.code = v.code
join public.substances s on s.slug = v.slug
on conflict (product_id, substance_id) do nothing;

-- Prefix ^MT[0-9] mapped MT-1 (Melanotan I) to melanotan-ii. Glow name heuristic mapped KL80 (Klow).
-- Those identities are unresolved; remove mapping rows only (products unchanged).
delete from public.product_substances ps
using public.products p
where ps.product_id = p.id
  and p.code in ('MT1', 'KL80');
