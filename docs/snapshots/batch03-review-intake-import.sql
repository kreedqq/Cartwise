-- Batch 03 review intake import. NOT a numbered migration.

-- Apply only after 0030, never against production in Phase 16.

-- Idempotent. review_status is always review-required. No claims/evidence/regulatory writes.

begin;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effect of BPC-157 on Symptoms in Patients with Interstitial Cystitis: A Pilot Study.', 'NCBI PubMed',
  '2024 Oct', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/39325560/',
  null, '39325560', null,
  array['bpc-157:pubmed:39325560']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'bpc-157:pubmed:39325560'
from public.sources s
join public.substances sub on sub.slug = 'bpc-157'
where s.pmid = '39325560'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Stable gastric pentadecapeptide BPC 157-NO-system relation.', 'NCBI PubMed',
  '2014', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/23755725/',
  '10.2174/13816128113190990411', '23755725', null,
  array['bpc-157:pubmed:23755725']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'bpc-157:pubmed:23755725'
from public.sources s
join public.substances sub on sub.slug = 'bpc-157'
where s.pmid = '23755725'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'BPC 157 Therapy: Targeting Angiogenesis and Nitric Oxide''s Cytotoxic and Damaging Actions, but Maintaining, Promoting, or Recovering Their Essential Protective Functions. Comment on Józwiak et al. Multifunctionality and Possible Medical Application of the BPC 157 Peptide-Literature and Patent Review. Pharmaceuticals 2025, 18, 185.', 'NCBI PubMed',
  '2025 Sep 28', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/41155565/',
  '10.3390/ph18101450', '41155565', null,
  array['bpc-157:pubmed:41155565']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'bpc-157:pubmed:41155565'
from public.sources s
join public.substances sub on sub.slug = 'bpc-157'
where s.pmid = '41155565'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Safety of Intravenous Infusion of BPC157 in Humans: A Pilot Study.', 'NCBI PubMed',
  '2025 Sep', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40131143/',
  null, '40131143', null,
  array['bpc-157:pubmed:40131143']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'bpc-157:pubmed:40131143'
from public.sources s
join public.substances sub on sub.slug = 'bpc-157'
where s.pmid = '40131143'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Pentadecapeptide BPC 157 attenuates chronic amphetamine-induced behavior disturbances.', 'NCBI PubMed',
  '2002 May', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/11978191/',
  null, '11978191', null,
  array['bpc-157:pubmed:11978191']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'bpc-157:pubmed:11978191'
from public.sources s
join public.substances sub on sub.slug = 'bpc-157'
where s.pmid = '11978191'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Research Study to See How Well CagriSema Compared to Semaglutide, Cagrilintide and Placebo Lowers Blood Sugar and Body Weight in People With Type 2 Diabetes Treated With Metformin With or Without an SGLT2 Inhibitor', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06065540',
  null, null, 'NCT06065540',
  array['cagrilintide:clinical_trial:NCT06065540']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:clinical_trial:NCT06065540'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.nct_id = 'NCT06065540'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Research Study to Compare Blood Levels of Cagrilintide After Multiple Doses of Different Versions of Cagrilintide in Adults With Overweight or Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07597018',
  null, null, 'NCT07597018',
  array['cagrilintide:clinical_trial:NCT07597018']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:clinical_trial:NCT07597018'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.nct_id = 'NCT07597018'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Evaluation of the Tolerability of Cagrilintide in Participants Not Tolerating GLP-1-RA Therapies Due to Gastrointestinal Adverse Events', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07607587',
  null, null, 'NCT07607587',
  array['cagrilintide:clinical_trial:NCT07607587']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:clinical_trial:NCT07607587'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.nct_id = 'NCT07607587'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Research Study Looking Into How Cagrilintide Influences Food Intake and Appetite in People With Overweight or Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07557953',
  null, null, 'NCT07557953',
  array['cagrilintide:clinical_trial:NCT07557953']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:clinical_trial:NCT07557953'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.nct_id = 'NCT07557953'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Understanding the Effect of CagriSema, Cagrilintide, and Semaglutide on Muscle Health (Role of Amylin Signature in Muscle Health)', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07527195',
  null, null, 'NCT07527195',
  array['cagrilintide:clinical_trial:NCT07527195']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:clinical_trial:NCT07527195'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.nct_id = 'NCT07527195'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Development of Cagrilintide, a Long-Acting Amylin Analogue.', 'NCBI PubMed',
  '2021 Aug 12', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/34288673/',
  '10.1021/acs.jmedchem.1c00565', '34288673', null,
  array['cagrilintide:pubmed:34288673']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cagrilintide:pubmed:34288673'
from public.sources s
join public.substances sub on sub.slug = 'cagrilintide'
where s.pmid = '34288673'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Human growth hormone-releasing factor (hGRF)1-29-albumin bioconjugates activate the GRF receptor on the anterior pituitary in rats: identification of CJC-1295 as a long-lasting GRF analog.', 'NCBI PubMed',
  '2005 Jul', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/15817669/',
  '10.1210/en.2004-1286', '15817669', null,
  array['cjc-1295:pubmed:15817669']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'cjc-1295:pubmed:15817669'
from public.sources s
join public.substances sub on sub.slug = 'cjc-1295'
where s.pmid = '15817669'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Improved laccase production by Trametes versicolor using Copper-Glycyl-L-Histidyl-L-Lysine as a novel and high-efficient inducer.', 'NCBI PubMed',
  '2023', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/37180036/',
  '10.3389/fbioe.2023.1176352', '37180036', null,
  array['ghk-cu:pubmed:37180036']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:37180036'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '37180036'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Chelating Surfaces for Oriented Human Serum Albumin Molecules.', 'NCBI PubMed',
  '2019 Mar 5', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/30741553/',
  '10.1021/acs.langmuir.9b00068', '30741553', null,
  array['ghk-cu:pubmed:30741553']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:30741553'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '30741553'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Microneedle-Mediated Delivery of Copper Peptide Through Skin.', 'NCBI PubMed',
  '2015 Aug', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/25690343/',
  '10.1007/s11095-015-1652-z', '25690343', null,
  array['ghk-cu:pubmed:25690343']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:25690343'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '25690343'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Stimulation of sulfated glycosaminoglycan synthesis by the tripeptide-copper complex glycyl-L-histidyl-L-lysine-Cu2+.', 'NCBI PubMed',
  '1992', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/1522753/',
  '10.1016/0024-3205(92)90504-i', '1522753', null,
  array['ghk-cu:pubmed:1522753']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:1522753'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '1522753'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Simultaneous determination of glycyl-L-histidyl-L-lysine and its metabolite, L-histidyl-L-lysine, in rat plasma by high-performance liquid chromatography with post-column derivatization.', 'NCBI PubMed',
  '1997 Apr 25', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/9187381/',
  '10.1016/s0378-4347(96)00460-4', '9187381', null,
  array['ghk-cu:pubmed:9187381']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:9187381'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '9187381'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Combination Tripeptide/Hexapeptide Serum with 1540 nm Nonablative Fractional Laser for the Treatment of Striae Distensae: A Pilot Study.', 'NCBI PubMed',
  '2020', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/33397562/',
  null, '33397562', null,
  array['ghk-cu:pubmed:33397562']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ghk-cu:pubmed:33397562'
from public.sources s
join public.substances sub on sub.slug = 'ghk-cu'
where s.pmid = '33397562'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Biosynthesis of human chorionic gonadotropin.', 'NCBI PubMed',
  '1980 Summer', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/6262070/',
  '10.1210/edrv-1-3-268', '6262070', null,
  array['hcg:pubmed:6262070']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'hcg:pubmed:6262070'
from public.sources s
join public.substances sub on sub.slug = 'hcg'
where s.pmid = '6262070'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Human chorionic gonadotropin-like proteins: secretion in nonpregnant humans and production by bacteria.', 'NCBI PubMed',
  '1992', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/1413384/',
  null, '1413384', null,
  array['hcg:pubmed:1413384']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'hcg:pubmed:1413384'
from public.sources s
join public.substances sub on sub.slug = 'hcg'
where s.pmid = '1413384'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Use of a gonadotropin-releasing hormone agonist or human chorionic gonadotropin for timed insemination in cattle.', 'NCBI PubMed',
  '1996 May', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/8726741/',
  '10.2527/1996.7451084x', '8726741', null,
  array['hcg:pubmed:8726741']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'hcg:pubmed:8726741'
from public.sources s
join public.substances sub on sub.slug = 'hcg'
where s.pmid = '8726741'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Ipamorelin, the first selective growth hormone secretagogue.', 'NCBI PubMed',
  '1998 Nov', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/9849822/',
  '10.1530/eje.0.1390552', '9849822', null,
  array['ipamorelin:pubmed:9849822']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ipamorelin:pubmed:9849822'
from public.sources s
join public.substances sub on sub.slug = 'ipamorelin'
where s.pmid = '9849822'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Highly potent growth hormone secretagogues: hybrids of NN703 and ipamorelin.', 'NCBI PubMed',
  '2001 Jul 23', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/11459660/',
  '10.1016/s0960-894x(01)00345-6', '11459660', null,
  array['ipamorelin:pubmed:11459660']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ipamorelin:pubmed:11459660'
from public.sources s
join public.substances sub on sub.slug = 'ipamorelin'
where s.pmid = '11459660'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Pharmacokinetic evaluation of ipamorelin and other peptidyl growth hormone secretagogues with emphasis on nasal absorption.', 'NCBI PubMed',
  '1998 Nov', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/9879640/',
  '10.1080/004982598238976', '9879640', null,
  array['ipamorelin:pubmed:9879640']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ipamorelin:pubmed:9879640'
from public.sources s
join public.substances sub on sub.slug = 'ipamorelin'
where s.pmid = '9879640'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'The influence of conformational restriction in the C-terminus of growth hormone secretagogues on their potency.', 'NCBI PubMed',
  '2002 Jun', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/12204475/',
  '10.1016/s0223-5234(02)01370-3', '12204475', null,
  array['ipamorelin:pubmed:12204475']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ipamorelin:pubmed:12204475'
from public.sources s
join public.substances sub on sub.slug = 'ipamorelin'
where s.pmid = '12204475'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Use of Liraglutide in Children Aged 6 to 12 Years With Severe Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07590219',
  null, null, 'NCT07590219',
  array['liraglutide:clinical_trial:NCT07590219']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:clinical_trial:NCT07590219'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.nct_id = 'NCT07590219'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Liraglutide Effect in Atrial Fibrillation', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT03856632',
  null, null, 'NCT03856632',
  array['liraglutide:clinical_trial:NCT03856632']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:clinical_trial:NCT03856632'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.nct_id = 'NCT03856632'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Liraglutide safety and efficacy in patients with non-alcoholic steatohepatitis (LEAN): a multicentre, double-blind, randomised, placebo-controlled phase 2 study.', 'NCBI PubMed',
  '2016 Feb 13', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/26608256/',
  '10.1016/s0140-6736(15)00803-x', '26608256', null,
  array['liraglutide:pubmed:26608256']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:26608256'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '26608256'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Liraglutide for Children 6 to <12 Years of Age with Obesity - A Randomized Trial.', 'NCBI PubMed',
  '2025 Feb 6', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/39258838/',
  '10.1056/nejmoa2407379', '39258838', null,
  array['liraglutide:pubmed:39258838']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:39258838'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '39258838'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effect of liraglutide 3.0 mg in individuals with obesity and moderate or severe obstructive sleep apnea: the SCALE Sleep Apnea randomized clinical trial.', 'NCBI PubMed',
  '2016 Aug', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/27005405/',
  '10.1038/ijo.2016.52', '27005405', null,
  array['liraglutide:pubmed:27005405']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:27005405'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '27005405'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Efficacy and safety of semaglutide compared with liraglutide and placebo for weight loss in patients with obesity: a randomised, double-blind, placebo and active controlled, dose-ranging, phase 2 trial.', 'NCBI PubMed',
  '2018 Aug 25', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/30122305/',
  '10.1016/s0140-6736(18)31773-2', '30122305', null,
  array['liraglutide:pubmed:30122305']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:30122305'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '30122305'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Safety and Efficacy of Liraglutide, 3.0 mg, Once Daily vs Placebo in Patients With Poor Weight Loss Following Metabolic Surgery: The BARI-OPTIMISE Randomized Clinical Trial.', 'NCBI PubMed',
  '2023 Oct 1', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/37494014/',
  '10.1001/jamasurg.2023.2930', '37494014', null,
  array['liraglutide:pubmed:37494014']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:37494014'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '37494014'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Evaluation and comparison of efficacy and safety of tirzepatide, liraglutide and SGLT2i in patients with type 2 diabetes mellitus: a network meta-analysis.', 'NCBI PubMed',
  '2024 Dec 24', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/39719583/',
  '10.1186/s12902-024-01805-z', '39719583', null,
  array['liraglutide:pubmed:39719583']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:39719583'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '39719583'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Liraglutide 3 mg on weight, body composition, and hormonal and metabolic parameters in women with obesity and polycystic ovary syndrome: a randomized placebo-controlled-phase 3 study.', 'NCBI PubMed',
  '2022 Aug', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/35710599/',
  '10.1016/j.fertnstert.2022.04.027', '35710599', null,
  array['liraglutide:pubmed:35710599']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:35710599'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '35710599'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', '3 years of liraglutide versus placebo for type 2 diabetes risk reduction and weight management in individuals with prediabetes: a randomised, double-blind trial.', 'NCBI PubMed',
  '2017 Apr 8', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/28237263/',
  '10.1016/s0140-6736(17)30069-7', '28237263', null,
  array['liraglutide:pubmed:28237263']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:28237263'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '28237263'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Efficacy and safety of once-weekly semaglutide 1.0mg vs once-daily liraglutide 1.2mg as add-on to 1-3 oral antidiabetic drugs in subjects with type 2 diabetes (SUSTAIN 10).', 'NCBI PubMed',
  '2020 Apr', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/31539622/',
  '10.1016/j.diabet.2019.101117', '31539622', null,
  array['liraglutide:pubmed:31539622']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'liraglutide:pubmed:31539622'
from public.sources s
join public.substances sub on sub.slug = 'liraglutide'
where s.pmid = '31539622'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study Comparing IBI362 vs Semaglutide in Chinese Overweight or Obese Adults With Metabolic Dysfunction-associated Fatty Liver Disease （MAFLD）', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06884293',
  null, null, 'NCT06884293',
  array['mazdutide:clinical_trial:NCT06884293']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:clinical_trial:NCT06884293'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.nct_id = 'NCT06884293'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of LY3305677 Compared With Placebo in Adult Participants With Obesity or Overweight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06124807',
  null, null, 'NCT06124807',
  array['mazdutide:clinical_trial:NCT06124807']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:clinical_trial:NCT06124807'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.nct_id = 'NCT06124807'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'ASCEND-1: Lifestyle Intervention Plus Mazdutide for Weight Management', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07517042',
  null, null, 'NCT07517042',
  array['mazdutide:clinical_trial:NCT07517042']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:clinical_trial:NCT07517042'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.nct_id = 'NCT07517042'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of IBI362 in Chinese Adolescents With Obesity or Overweight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07255209',
  null, null, 'NCT07255209',
  array['mazdutide:clinical_trial:NCT07255209']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:clinical_trial:NCT07255209'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.nct_id = 'NCT07255209'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Tolerance and Pharmacokinetic/Pharmacokinetic Study of IBI362 15mg in Patients With Moderate to Severe Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07000955',
  null, null, 'NCT07000955',
  array['mazdutide:clinical_trial:NCT07000955']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:clinical_trial:NCT07000955'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.nct_id = 'NCT07000955'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Mazdutide versus placebo in Chinese adults with type 2 diabetes.', 'NCBI PubMed',
  '2026 Apr', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/41407859/',
  '10.1038/s41586-025-10026-w', '41407859', null,
  array['mazdutide:pubmed:41407859']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:pubmed:41407859'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.pmid = '41407859'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Mazdutide reduces body weight in adults with overweight or obesity: A high-dose Phase 1 trial.', 'NCBI PubMed',
  '2025 Nov', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40832785/',
  '10.1111/dom.70040', '40832785', null,
  array['mazdutide:pubmed:40832785']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mazdutide:pubmed:40832785'
from public.sources s
join public.substances sub on sub.slug = 'mazdutide'
where s.pmid = '40832785'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Melanocortin receptor agonists, penile erection, and sexual motivation: human studies with Melanotan II.', 'NCBI PubMed',
  '2000 Oct', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/11035391/',
  '10.1038/sj.ijir.3900582', '11035391', null,
  array['melanotan-ii:pubmed:11035391']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'melanotan-ii:pubmed:11035391'
from public.sources s
join public.substances sub on sub.slug = 'melanotan-ii'
where s.pmid = '11035391'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Systemic delivery of melanotan II through the ocular route in rabbits.', 'NCBI PubMed',
  '1997 Mar', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/9050812/',
  '10.1021/js9604265', '9050812', null,
  array['melanotan-ii:pubmed:9050812']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'melanotan-ii:pubmed:9050812'
from public.sources s
join public.substances sub on sub.slug = 'melanotan-ii'
where s.pmid = '9050812'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'A comparison of HPLC and bioassay methods for plasma melanotan-II (MT-II) determination: application to a pharmacokinetic study in rats.', 'NCBI PubMed',
  '1994 Jul', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/7981427/',
  '10.1002/bdd.2510150505', '7981427', null,
  array['melanotan-ii:pubmed:7981427']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'melanotan-ii:pubmed:7981427'
from public.sources s
join public.substances sub on sub.slug = 'melanotan-ii'
where s.pmid = '7981427'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Peripheral Administration of a Cell-Penetrating MOTS-c Analogue Enhances Memory and Attenuates Aβ(1-42)- or LPS-Induced Memory Impairment through Inhibiting Neuroinflammation.', 'NCBI PubMed',
  '2021 May 5', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/33861582/',
  '10.1021/acschemneuro.0c00782', '33861582', null,
  array['mots-c:pubmed:33861582']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mots-c:pubmed:33861582'
from public.sources s
join public.substances sub on sub.slug = 'mots-c'
where s.pmid = '33861582'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Reduced skeletal muscle expression of mitochondrial-derived peptides humanin and MOTS-C and Nrf2 in chronic kidney disease.', 'NCBI PubMed',
  '2019 Nov 1', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/31432706/',
  '10.1152/ajprenal.00202.2019', '31432706', null,
  array['mots-c:pubmed:31432706']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'mots-c:pubmed:31432706'
from public.sources s
join public.substances sub on sub.slug = 'mots-c'
where s.pmid = '31432706'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Drug-Drug Interaction (DDI) Study of Orforglipron With Carbamazepine in Healthy Participants', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06370728',
  null, null, 'NCT06370728',
  array['orforglipron:clinical_trial:NCT06370728']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:clinical_trial:NCT06370728'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.nct_id = 'NCT06370728'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of LY3502970 in Chinese Participants With Obesity or Are Overweight With Weight-related Comorbidities', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06023095',
  null, null, 'NCT06023095',
  array['orforglipron:clinical_trial:NCT06023095']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:clinical_trial:NCT06023095'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.nct_id = 'NCT06023095'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study to Compare Tablets and Capsules of Orforglipron (LY3502970) in Healthy Participants Who Are Obese or Overweight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06440980',
  null, null, 'NCT06440980',
  array['orforglipron:clinical_trial:NCT06440980']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:clinical_trial:NCT06440980'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.nct_id = 'NCT06440980'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of LY3502970 in Japanese Participants With Type 2 Diabetes Mellitus', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT05086445',
  null, null, 'NCT05086445',
  array['orforglipron:clinical_trial:NCT05086445']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:clinical_trial:NCT05086445'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.nct_id = 'NCT05086445'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Disposition and Absolute Bioavailability of Orally Administered Orforglipron in Healthy Participants.', 'NCBI PubMed',
  '2026 Jan', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40888509/',
  '10.1002/cpdd.1594', '40888509', null,
  array['orforglipron:pubmed:40888509']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:pubmed:40888509'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.pmid = '40888509'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Orforglipron, an oral small-molecule GLP-1 receptor agonist, for the treatment of obesity in people with type 2 diabetes (ATTAIN-2): a phase 3, double-blind, randomised, multicentre, placebo-controlled trial.', 'NCBI PubMed',
  '2026 Dec 20', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/41275875/',
  '10.1016/s0140-6736(25)02165-8', '41275875', null,
  array['orforglipron:pubmed:41275875']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:pubmed:41275875'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.pmid = '41275875'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of Retatrutide (LY3437943) in Participants Without Type 2 Diabetes Who Have Obesity or Overweight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07357415',
  null, null, 'NCT07357415',
  array['retatrutide:clinical_trial:NCT07357415']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT07357415'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT07357415'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of Retatrutide (LY3437943) in Participants With Obesity or Overweight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07232719',
  null, null, 'NCT07232719',
  array['retatrutide:clinical_trial:NCT07232719']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT07232719'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT07232719'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Effect of Retatrutide Compared With Semaglutide in Adult Participants With Type 2 Diabetes and Inadequate Glycemic Control With Metformin With or Without SGLT2 Inhibitor (TRANSCEND-T2D-2)', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06260722',
  null, null, 'NCT06260722',
  array['retatrutide:clinical_trial:NCT06260722']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT06260722'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT06260722'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of Retatrutide (LY3437943) in the Maintenance of Weight Reduction in Individuals With Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT06859268',
  null, null, 'NCT06859268',
  array['retatrutide:clinical_trial:NCT06859268']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT06859268'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT06859268'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of Retatrutide (LY3437943) Once Weekly in Participants Who Have Obesity or Overweight and Osteoarthritis of the Knee', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT05931367',
  null, null, 'NCT05931367',
  array['retatrutide:clinical_trial:NCT05931367']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT05931367'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT05931367'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Study of Retatrutide (LY3437943) on Renal Function in Participants With Overweight or Obesity and Chronic Kidney Disease With or Without Type 2 Diabetes', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT05936151',
  null, null, 'NCT05936151',
  array['retatrutide:clinical_trial:NCT05936151']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:clinical_trial:NCT05936151'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.nct_id = 'NCT05936151'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Retatrutide showing promise in obesity (and type 2 diabetes).', 'NCBI PubMed',
  '2023 Jul-Dec', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/37947489/',
  '10.1080/13543784.2023.2283020', '37947489', null,
  array['retatrutide:pubmed:37947489']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:pubmed:37947489'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.pmid = '37947489'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Retatrutide for the treatment of obesity, obstructive sleep apnea and knee osteoarthritis: Rationale and design of the TRIUMPH registrational clinical trials.', 'NCBI PubMed',
  '2026 Jan', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/41090431/',
  '10.1111/dom.70209', '41090431', null,
  array['retatrutide:pubmed:41090431']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:pubmed:41090431'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.pmid = '41090431'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Efficacy and safety of retatrutide, a novel GLP-1, GIP, and glucagon receptor agonist for obesity treatment: a systematic review and meta-analysis of randomized controlled trials.', 'NCBI PubMed',
  '2025', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40291085/',
  '10.1080/08998280.2025.2456441', '40291085', null,
  array['retatrutide:pubmed:40291085']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:pubmed:40291085'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.pmid = '40291085'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Efficacy and safety of retatrutide for the treatment of obesity: a systematic review of clinical trials.', 'NCBI PubMed',
  '2025 Jul 1', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40728138/',
  '10.1515/jbcpp-2025-0113', '40728138', null,
  array['retatrutide:pubmed:40728138']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:pubmed:40728138'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.pmid = '40728138'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effects of once-weekly subcutaneous retatrutide on weight and metabolic markers: A systematic review and meta-analysis of randomized controlled trials.', 'NCBI PubMed',
  '2024 Dec', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/39318607/',
  '10.1016/j.metop.2024.100321', '39318607', null,
  array['retatrutide:pubmed:39318607']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'retatrutide:pubmed:39318607'
from public.sources s
join public.substances sub on sub.slug = 'retatrutide'
where s.pmid = '39318607'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'HMB Plus Vitamin D to Preserve Muscle in Older Adults Starting Semaglutide', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07760948',
  null, null, 'NCT07760948',
  array['semaglutide:clinical_trial:NCT07760948']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:clinical_trial:NCT07760948'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.nct_id = 'NCT07760948'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Research Study on How Well Oral Semaglutide Works for Weight Loss in Adults With Excess Body Weight', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07770841',
  null, null, 'NCT07770841',
  array['semaglutide:clinical_trial:NCT07770841']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:clinical_trial:NCT07770841'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.nct_id = 'NCT07770841'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Semaglutide in Youth With Autism Spectrum Disorder', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07770152',
  null, null, 'NCT07770152',
  array['semaglutide:clinical_trial:NCT07770152']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:clinical_trial:NCT07770152'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.nct_id = 'NCT07770152'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Research Study Looking at the Effect of Semaglutide on the Immune System and Other Biological Processes in People With Alzheimer''s Disease', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT05891496',
  null, null, 'NCT05891496',
  array['semaglutide:clinical_trial:NCT05891496']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:clinical_trial:NCT05891496'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.nct_id = 'NCT05891496'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Efficacy and Safety of Semaglutide Versus Placebo on Cardiometabolic Profile in Patients With Schizophrenia With Metabolic Syndrome', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07770282',
  null, null, 'NCT07770282',
  array['semaglutide:clinical_trial:NCT07770282']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:clinical_trial:NCT07770282'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.nct_id = 'NCT07770282'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effect of Continued Weekly Subcutaneous Semaglutide vs Placebo on Weight Loss Maintenance in Adults With Overweight or Obesity: The STEP 4 Randomized Clinical Trial.', 'NCBI PubMed',
  '2021 Apr 13', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/33755728/',
  '10.1001/jama.2021.3224', '33755728', null,
  array['semaglutide:pubmed:33755728']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:33755728'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '33755728'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effect of Subcutaneous Semaglutide vs Placebo as an Adjunct to Intensive Behavioral Therapy on Body Weight in Adults With Overweight or Obesity: The STEP 3 Randomized Clinical Trial.', 'NCBI PubMed',
  '2021 Apr 13', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/33625476/',
  '10.1001/jama.2021.1831', '33625476', null,
  array['semaglutide:pubmed:33625476']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:33625476'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '33625476'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effect of Weekly Subcutaneous Semaglutide vs Daily Liraglutide on Body Weight in Adults With Overweight or Obesity Without Diabetes: The STEP 8 Randomized Clinical Trial.', 'NCBI PubMed',
  '2022 Jan 11', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/35015037/',
  '10.1001/jama.2021.23619', '35015037', null,
  array['semaglutide:pubmed:35015037']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:35015037'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '35015037'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Weight regain and cardiometabolic effects after withdrawal of semaglutide: The STEP 1 trial extension.', 'NCBI PubMed',
  '2022 Aug', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/35441470/',
  '10.1111/dom.14725', '35441470', null,
  array['semaglutide:pubmed:35441470']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:35441470'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '35441470'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Safety of Semaglutide.', 'NCBI PubMed',
  '2021', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/34305810/',
  '10.3389/fendo.2021.645563', '34305810', null,
  array['semaglutide:pubmed:34305810']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:34305810'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '34305810'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Once-weekly semaglutide 7·2 mg in adults with obesity (STEP UP): a randomised, controlled, phase 3b trial.', 'NCBI PubMed',
  '2025 Nov', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/40961952/',
  '10.1016/s2213-8587(25)00226-8', '40961952', null,
  array['semaglutide:pubmed:40961952']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:40961952'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '40961952'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Semaglutide in patients with overweight or obesity and chronic kidney disease without diabetes: a randomized double-blind placebo-controlled clinical trial.', 'NCBI PubMed',
  '2025 Jan', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/39455729/',
  '10.1038/s41591-024-03327-6', '39455729', null,
  array['semaglutide:pubmed:39455729']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:39455729'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '39455729'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Effects of oral semaglutide on cardiovascular outcomes in individuals with type 2 diabetes and established atherosclerotic cardiovascular disease and/or chronic kidney disease: Design and baseline characteristics of SOUL, a randomized trial.', 'NCBI PubMed',
  '2023 Jul', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/36945734/',
  '10.1111/dom.15058', '36945734', null,
  array['semaglutide:pubmed:36945734']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:36945734'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '36945734'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Degradation of the ACTH(4-10) analog Semax in the presence of rat basal forebrain cell cultures and plasma membranes.', 'NCBI PubMed',
  '2006 Jun', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/16773243/',
  '10.1007/s00726-006-0328-8', '16773243', null,
  array['semax:pubmed:16773243']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semax:pubmed:16773243'
from public.sources s
join public.substances sub on sub.slug = 'semax'
where s.pmid = '16773243'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', '[Kinetics of Semax penetration into the brain and blood of rats after its intranasal administration].', 'NCBI PubMed',
  '2006 Jan-Feb', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/16523722/',
  '10.1134/s1068162006010055', '16523722', null,
  array['semax:pubmed:16523722']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semax:pubmed:16523722'
from public.sources s
join public.substances sub on sub.slug = 'semax'
where s.pmid = '16523722'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Once daily subcutaneous growth hormone-releasing hormone therapy accelerates growth in growth hormone-deficient children during the first year of therapy. Geref International Study Group.', 'NCBI PubMed',
  '1996 Mar', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/8772599/',
  '10.1210/jcem.81.3.8772599', '8772599', null,
  array['sermorelin:pubmed:8772599']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'sermorelin:pubmed:8772599'
from public.sources s
join public.substances sub on sub.slug = 'sermorelin'
where s.pmid = '8772599'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Somatropin for the treatment of short bowel syndrome in adults.', 'NCBI PubMed',
  '2005 Aug', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/16086660/',
  '10.1517/14656566.6.10.1741', '16086660', null,
  array['somatropin:pubmed:16086660']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'somatropin:pubmed:16086660'
from public.sources s
join public.substances sub on sub.slug = 'somatropin'
where s.pmid = '16086660'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Comparison of various in vitro model systems of the metabolism of synthetic doping peptides: Proteolytic enzymes, human blood serum, liver and kidney microsomes and liver S9 fraction.', 'NCBI PubMed',
  '2016 Oct 21', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/27569051/',
  '10.1016/j.jprot.2016.08.016', '27569051', null,
  array['tb-500:pubmed:27569051']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tb-500:pubmed:27569051'
from public.sources s
join public.substances sub on sub.slug = 'tb-500'
where s.pmid = '27569051'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Tesamorelin: a growth hormone-releasing factor analogue for HIV-associated lipodystrophy.', 'NCBI PubMed',
  '2012 Feb', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/22298602/',
  '10.1345/aph.1q629', '22298602', null,
  array['tesamorelin:pubmed:22298602']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tesamorelin:pubmed:22298602'
from public.sources s
join public.substances sub on sub.slug = 'tesamorelin'
where s.pmid = '22298602'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Delineating tesamorelin response pathways in HIV-associated NAFLD using a targeted proteomic and transcriptomic approach.', 'NCBI PubMed',
  '2021 May 18', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/34006921/',
  '10.1038/s41598-021-89966-y', '34006921', null,
  array['tesamorelin:pubmed:34006921']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tesamorelin:pubmed:34006921'
from public.sources s
join public.substances sub on sub.slug = 'tesamorelin'
where s.pmid = '34006921'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Tesamorelin as an Adjunct to Exercise for Improving Physical Function in HIV (TRIUMPH): a clinical trial protocol.', 'NCBI PubMed',
  '2026 Jul 8', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/42419889/',
  '10.1136/bmjopen-2026-120740', '42419889', null,
  array['tesamorelin:pubmed:42419889']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tesamorelin:pubmed:42419889'
from public.sources s
join public.substances sub on sub.slug = 'tesamorelin'
where s.pmid = '42419889'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Impact of Tesamorelin, a Growth Hormone-Releasing Factor (GRF) Analogue, on the Pharmacokinetics of Simvastatin and Ritonavir in Healthy Volunteers.', 'NCBI PubMed',
  '2013 Jul', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/27121785/',
  '10.1002/cpdd.27', '27121785', null,
  array['tesamorelin:pubmed:27121785']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tesamorelin:pubmed:27121785'
from public.sources s
join public.substances sub on sub.slug = 'tesamorelin'
where s.pmid = '27121785'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Side effects and complications. Clinical trials of tesamorelin in Canada.', 'NCBI PubMed',
  '2007 Mar-Apr', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/17571443/',
  null, '17571443', null,
  array['tesamorelin:pubmed:17571443']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tesamorelin:pubmed:17571443'
from public.sources s
join public.substances sub on sub.slug = 'tesamorelin'
where s.pmid = '17571443'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Thymosin alpha1 use in adult COVID-19 patients: A systematic review and meta-analysis on clinical outcomes.', 'NCBI PubMed',
  '2023 Jan', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/36527881/',
  '10.1016/j.intimp.2022.109584', '36527881', null,
  array['thymosin-alpha-1:pubmed:36527881']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-alpha-1:pubmed:36527881'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-alpha-1'
where s.pmid = '36527881'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Safety and Efficacy of Thymosin Beta 4 Ophthalmic Solution in Patients With Dry Eye', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT01387347',
  null, null, 'NCT01387347',
  array['thymosin-beta-4:clinical_trial:NCT01387347']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:clinical_trial:NCT01387347'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.nct_id = 'NCT01387347'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Phase 2 Study of the Safety and Efficacy of Thymosin Beta 4 for Treating Corneal Wounds', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT00598871',
  null, null, 'NCT00598871',
  array['thymosin-beta-4:clinical_trial:NCT00598871']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:clinical_trial:NCT00598871'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.nct_id = 'NCT00598871'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'A Phase 2 Study on Effect of Thymosin Beta 4 on Wound Healing in Patients With Epidermolysis Bullosa', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT00311766',
  null, null, 'NCT00311766',
  array['thymosin-beta-4:clinical_trial:NCT00311766']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:clinical_trial:NCT00311766'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.nct_id = 'NCT00311766'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Study of Thymosin Beta 4 in Patients With Venous Stasis Ulcers', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT00832091',
  null, null, 'NCT00832091',
  array['thymosin-beta-4:clinical_trial:NCT00832091']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:clinical_trial:NCT00832091'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.nct_id = 'NCT00832091'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Study of Thymosin Beta 4 in Patients With Pressure Ulcers', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT00382174',
  null, null, 'NCT00382174',
  array['thymosin-beta-4:clinical_trial:NCT00382174']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:clinical_trial:NCT00382174'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.nct_id = 'NCT00382174'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Thymosin beta-4 and venous ulcers: clinical remarks on a European prospective, randomized study on safety, tolerability, and enhancement on healing.', 'NCBI PubMed',
  '2007 Sep', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/17495250/',
  '10.1196/annals.1415.003', '17495250', null,
  array['thymosin-beta-4:pubmed:17495250']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'thymosin-beta-4:pubmed:17495250'
from public.sources s
join public.substances sub on sub.slug = 'thymosin-beta-4'
where s.pmid = '17495250'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Tirzepatide in Idiopathic Intracranial Hypertension Trial', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07191873',
  null, null, 'NCT07191873',
  array['tirzepatide:clinical_trial:NCT07191873']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:clinical_trial:NCT07191873'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.nct_id = 'NCT07191873'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Resistance Training to Prevent Muscle Loss During Treatment With Tirzepatide', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07777575',
  null, null, 'NCT07777575',
  array['tirzepatide:clinical_trial:NCT07777575']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:clinical_trial:NCT07777575'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.nct_id = 'NCT07777575'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'The Effect of Tirzepatide on Menopausal Vasomotor Symptoms and Biological Aging in Post-menopausal Women With Obesity', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07218445',
  null, null, 'NCT07218445',
  array['tirzepatide:clinical_trial:NCT07218445']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:clinical_trial:NCT07218445'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.nct_id = 'NCT07218445'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'clinical_trial', 'Tirzepatide for Treatment of CCCA', 'ClinicalTrials.gov',
  null, '2026-08-29', 'https://clinicaltrials.gov/study/NCT07734870',
  null, null, 'NCT07734870',
  array['tirzepatide:clinical_trial:NCT07734870']::text[], 'active', 'review-required', 'clinicaltrials.gov-v2'
)
on conflict (nct_id) where nct_id is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:clinical_trial:NCT07734870'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.nct_id = 'NCT07734870'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Continued Treatment With Tirzepatide for Maintenance of Weight Reduction in Adults With Obesity: The SURMOUNT-4 Randomized Clinical Trial.', 'NCBI PubMed',
  '2024 Jan 2', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/38078870/',
  '10.1001/jama.2023.24945', '38078870', null,
  array['tirzepatide:pubmed:38078870']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:pubmed:38078870'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.pmid = '38078870'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Tirzepatide once weekly for the treatment of obesity in people with type 2 diabetes (SURMOUNT-2): a double-blind, randomised, multicentre, placebo-controlled, phase 3 trial.', 'NCBI PubMed',
  '2023 Aug 19', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/37385275/',
  '10.1016/s0140-6736(23)01200-x', '37385275', null,
  array['tirzepatide:pubmed:37385275']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:pubmed:37385275'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.pmid = '37385275'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Comparison of tirzepatide and dulaglutide on major adverse cardiovascular events in participants with type 2 diabetes and atherosclerotic cardiovascular disease: SURPASS-CVOT design and baseline characteristics.', 'NCBI PubMed',
  '2024 Jan', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/37758044/',
  '10.1016/j.ahj.2023.09.007', '37758044', null,
  array['tirzepatide:pubmed:37758044']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:pubmed:37758044'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.pmid = '37758044'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Semaglutide vs Tirzepatide for Weight Loss in Adults With Overweight or Obesity.', 'NCBI PubMed',
  '2024 Sep 1', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/38976257/',
  '10.1001/jamainternmed.2024.2525', '38976257', null,
  array['tirzepatide:pubmed:38976257']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:pubmed:38976257'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.pmid = '38976257'
on conflict (source_id, substance_id) do nothing;

insert into public.sources (
  source_type, title, publisher, publication_date, access_date, url, doi, pmid, nct_id,
  legacy_ids, status, review_status, connector
) values (
  'pubmed', 'Efficacy and safety of a novel dual GIP and GLP-1 receptor agonist tirzepatide in patients with type 2 diabetes (SURPASS-1): a double-blind, randomised, phase 3 trial.', 'NCBI PubMed',
  '2021 Jul 10', '2026-08-29', 'https://pubmed.ncbi.nlm.nih.gov/34186022/',
  '10.1016/s0140-6736(21)01324-6', '34186022', null,
  array['tirzepatide:pubmed:34186022']::text[], 'active', 'review-required', 'ncbi-eutils'
)
on conflict (pmid) where pmid is not null do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'tirzepatide:pubmed:34186022'
from public.sources s
join public.substances sub on sub.slug = 'tirzepatide'
where s.pmid = '34186022'
on conflict (source_id, substance_id) do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'ipamorelin:pubmed:42578445'
from public.sources s
join public.substances sub on sub.slug = 'ipamorelin'
where s.pmid = '42578445'
on conflict (source_id, substance_id) do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'orforglipron:pubmed:42419792'
from public.sources s
join public.substances sub on sub.slug = 'orforglipron'
where s.pmid = '42419792'
on conflict (source_id, substance_id) do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:40353578'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '40353578'
on conflict (source_id, substance_id) do nothing;

insert into public.source_substances (source_id, substance_id, legacy_source_id)
select s.id, sub.id, 'semaglutide:pubmed:40544433'
from public.sources s
join public.substances sub on sub.slug = 'semaglutide'
where s.pmid = '40544433'
on conflict (source_id, substance_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06065540', 'A Research Study to See How Well CagriSema Compared to Semaglutide, Cagrilintide and Placebo Lowers Blood Sugar and Body Weight in People With Type 2 Diabetes Treated With Metformin With or Without an SGLT2 Inhibitor', 'Novo Nordisk A/S',
  'PHASE3', 'COMPLETED', 'Cagrilintide; Semaglutide; Placebo cagrilintide; Placebo semaglutide',
  'Type 2 Diabetes Mellitus', 'https://clinicaltrials.gov/study/NCT06065540', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'cagrilintide'
where st.nct_id = 'NCT06065540'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06065540'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07597018', 'A Research Study to Compare Blood Levels of Cagrilintide After Multiple Doses of Different Versions of Cagrilintide in Adults With Overweight or Obesity', 'Novo Nordisk A/S',
  'PHASE1', 'RECRUITING', 'Cagrilintide D; Cagrilintide B and placebo semaglutide I',
  'Obesity; Overweight', 'https://clinicaltrials.gov/study/NCT07597018', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'cagrilintide'
where st.nct_id = 'NCT07597018'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07597018'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07607587', 'Evaluation of the Tolerability of Cagrilintide in Participants Not Tolerating GLP-1-RA Therapies Due to Gastrointestinal Adverse Events', 'Novo Nordisk A/S',
  'PHASE1', 'RECRUITING', 'Cagrilintide; Placebo (matched to Cagrilintide)',
  'Obesity; Overweight', 'https://clinicaltrials.gov/study/NCT07607587', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'cagrilintide'
where st.nct_id = 'NCT07607587'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07607587'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07557953', 'A Research Study Looking Into How Cagrilintide Influences Food Intake and Appetite in People With Overweight or Obesity', 'Novo Nordisk A/S',
  'PHASE1', 'RECRUITING', 'Cagrilintide; Placebo Cagrilintide',
  'Overweight; Obesity', 'https://clinicaltrials.gov/study/NCT07557953', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'cagrilintide'
where st.nct_id = 'NCT07557953'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07557953'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07527195', 'Understanding the Effect of CagriSema, Cagrilintide, and Semaglutide on Muscle Health (Role of Amylin Signature in Muscle Health)', 'Novo Nordisk A/S',
  'PHASE1', 'RECRUITING', 'Cagrilintide; Semaglutide; Placebo cagrilintide; Placebo semaglutide',
  'Obesity', 'https://clinicaltrials.gov/study/NCT07527195', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'cagrilintide'
where st.nct_id = 'NCT07527195'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07527195'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07590219', 'Use of Liraglutide in Children Aged 6 to 12 Years With Severe Obesity', 'University of Sao Paulo General Hospital',
  'PHASE4', 'ACTIVE_NOT_RECRUITING', 'Liraglutide (Saxenda) 6Mg/Ml Inj Pen 3Ml',
  'Severe Obesity; Cardiovascular Function; Liraglutide; Childhood Obesity; Echocardiography; Speckle Tracking', 'https://clinicaltrials.gov/study/NCT07590219', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'liraglutide'
where st.nct_id = 'NCT07590219'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07590219'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT03856632', 'Liraglutide Effect in Atrial Fibrillation', 'University of Miami',
  'PHASE4', 'ACTIVE_NOT_RECRUITING', 'Liraglutide; RFM; Anti Arrhythmics; Afib Catheter Ablation',
  'Atrial Fibrillation', 'https://clinicaltrials.gov/study/NCT03856632', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'liraglutide'
where st.nct_id = 'NCT03856632'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT03856632'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06884293', 'A Study Comparing IBI362 vs Semaglutide in Chinese Overweight or Obese Adults With Metabolic Dysfunction-associated Fatty Liver Disease （MAFLD）', 'Innovent Biologics (Suzhou) Co. Ltd.',
  'PHASE3', 'ACTIVE_NOT_RECRUITING', 'IBI362; semaglutide',
  'Overweight; Metabolic Dysfunction-associated Fatty Liver Disease (MAFLD)', 'https://clinicaltrials.gov/study/NCT06884293', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'mazdutide'
where st.nct_id = 'NCT06884293'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06884293'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06124807', 'A Study of LY3305677 Compared With Placebo in Adult Participants With Obesity or Overweight', 'Eli Lilly and Company',
  'PHASE2', 'COMPLETED', 'Mazdutide; Placebo',
  'Obesity; Overweight and Obesity', 'https://clinicaltrials.gov/study/NCT06124807', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'mazdutide'
where st.nct_id = 'NCT06124807'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06124807'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07517042', 'ASCEND-1: Lifestyle Intervention Plus Mazdutide for Weight Management', 'Shanghai Zhongshan Hospital',
  'NA', 'RECRUITING', 'Mazdutide; Intensive Lifestyle Intervention',
  'Obesity; Weight Control', 'https://clinicaltrials.gov/study/NCT07517042', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'mazdutide'
where st.nct_id = 'NCT07517042'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07517042'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07255209', 'A Study of IBI362 in Chinese Adolescents With Obesity or Overweight', 'Innovent Biologics (Suzhou) Co. Ltd.',
  'PHASE3', 'RECRUITING', 'Placebo; IBI362',
  'Adolescents With Obesity or Overweight With Weight-Related Comorbidities', 'https://clinicaltrials.gov/study/NCT07255209', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'mazdutide'
where st.nct_id = 'NCT07255209'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07255209'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07000955', 'Tolerance and Pharmacokinetic/Pharmacokinetic Study of IBI362 15mg in Patients With Moderate to Severe Obesity', 'Innovent Biologics (Suzhou) Co. Ltd.',
  'PHASE1, PHASE2', 'ACTIVE_NOT_RECRUITING', 'Tirzepatide; Placebo; IBI362',
  'Obesity', 'https://clinicaltrials.gov/study/NCT07000955', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'mazdutide'
where st.nct_id = 'NCT07000955'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07000955'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06370728', 'A Drug-Drug Interaction (DDI) Study of Orforglipron With Carbamazepine in Healthy Participants', 'Eli Lilly and Company',
  'PHASE1', 'COMPLETED', 'Orforglipron; Carbamazepine',
  'Healthy', 'https://clinicaltrials.gov/study/NCT06370728', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'orforglipron'
where st.nct_id = 'NCT06370728'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06370728'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06023095', 'A Study of LY3502970 in Chinese Participants With Obesity or Are Overweight With Weight-related Comorbidities', 'Eli Lilly and Company',
  'PHASE1', 'COMPLETED', 'LY3502970; Placebo',
  'Overweight; Obesity', 'https://clinicaltrials.gov/study/NCT06023095', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'orforglipron'
where st.nct_id = 'NCT06023095'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06023095'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06440980', 'A Study to Compare Tablets and Capsules of Orforglipron (LY3502970) in Healthy Participants Who Are Obese or Overweight', 'Eli Lilly and Company',
  'PHASE1', 'COMPLETED', 'Orforglipron',
  'Healthy; Obese; Overweight; Obesity', 'https://clinicaltrials.gov/study/NCT06440980', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'orforglipron'
where st.nct_id = 'NCT06440980'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06440980'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT05086445', 'A Study of LY3502970 in Japanese Participants With Type 2 Diabetes Mellitus', 'Eli Lilly and Company',
  'PHASE1', 'COMPLETED', 'LY3502970; Placebo',
  'Diabetes Mellitus, Type 2', 'https://clinicaltrials.gov/study/NCT05086445', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'orforglipron'
where st.nct_id = 'NCT05086445'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT05086445'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07357415', 'A Study of Retatrutide (LY3437943) in Participants Without Type 2 Diabetes Who Have Obesity or Overweight', 'Eli Lilly and Company',
  'PHASE3', 'ACTIVE_NOT_RECRUITING', 'Retatrutide',
  'Obesity; Overweight', 'https://clinicaltrials.gov/study/NCT07357415', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT07357415'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07357415'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07232719', 'A Study of Retatrutide (LY3437943) in Participants With Obesity or Overweight', 'Eli Lilly and Company',
  'PHASE3', 'ACTIVE_NOT_RECRUITING', 'Retatrutide; Placebo',
  'Obesity; Overweight', 'https://clinicaltrials.gov/study/NCT07232719', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT07232719'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07232719'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06260722', 'Effect of Retatrutide Compared With Semaglutide in Adult Participants With Type 2 Diabetes and Inadequate Glycemic Control With Metformin With or Without SGLT2 Inhibitor (TRANSCEND-T2D-2)', 'Eli Lilly and Company',
  'PHASE3', 'ACTIVE_NOT_RECRUITING', 'Retatrutide; Semaglutide',
  'Diabetes Mellitus, Type 2', 'https://clinicaltrials.gov/study/NCT06260722', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT06260722'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06260722'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT06859268', 'A Study of Retatrutide (LY3437943) in the Maintenance of Weight Reduction in Individuals With Obesity', 'Eli Lilly and Company',
  'PHASE3', 'ACTIVE_NOT_RECRUITING', 'Retatrutide; Placebo',
  'Obesity', 'https://clinicaltrials.gov/study/NCT06859268', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT06859268'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT06859268'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT05931367', 'A Study of Retatrutide (LY3437943) Once Weekly in Participants Who Have Obesity or Overweight and Osteoarthritis of the Knee', 'Eli Lilly and Company',
  'PHASE3', 'COMPLETED', 'Retatrutide; Placebo',
  'Obesity; Overweight; Osteo Arthritis Knee', 'https://clinicaltrials.gov/study/NCT05931367', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT05931367'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT05931367'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT05936151', 'A Study of Retatrutide (LY3437943) on Renal Function in Participants With Overweight or Obesity and Chronic Kidney Disease With or Without Type 2 Diabetes', 'Eli Lilly and Company',
  'PHASE2', 'COMPLETED', 'Retatrutide; Placebo',
  'Overweight or Obesity; CKD; Type 2 Diabetes', 'https://clinicaltrials.gov/study/NCT05936151', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'retatrutide'
where st.nct_id = 'NCT05936151'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT05936151'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07760948', 'HMB Plus Vitamin D to Preserve Muscle in Older Adults Starting Semaglutide', 'Vanderbilt University Medical Center',
  'PHASE2', 'NOT_YET_RECRUITING', 'Calcium-HMB Plus Vitamin D3; Matching placebo',
  'Type 2 Diabetes Mellitus (T2DM); Sarcopenia; Obesity; Muscle Loss; Older Adults', 'https://clinicaltrials.gov/study/NCT07760948', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'semaglutide'
where st.nct_id = 'NCT07760948'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07760948'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07770841', 'Research Study on How Well Oral Semaglutide Works for Weight Loss in Adults With Excess Body Weight', 'Novo Nordisk A/S',
  'PHASE3', 'RECRUITING', 'Semaglutide; Placebo',
  'Overweight; Obesity', 'https://clinicaltrials.gov/study/NCT07770841', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'semaglutide'
where st.nct_id = 'NCT07770841'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07770841'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07770152', 'Semaglutide in Youth With Autism Spectrum Disorder', 'Children''s Hospital Medical Center, Cincinnati',
  'PHASE4', 'NOT_YET_RECRUITING', 'Glucagon-like peptide-1 receptor agonist：Semaglutide; Lifestyle Management (LSM) Counseling',
  'Autism Spectrum Disorder; Obesity', 'https://clinicaltrials.gov/study/NCT07770152', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'semaglutide'
where st.nct_id = 'NCT07770152'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07770152'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT05891496', 'A Research Study Looking at the Effect of Semaglutide on the Immune System and Other Biological Processes in People With Alzheimer''s Disease', 'Novo Nordisk A/S',
  'PHASE3', 'COMPLETED', 'Semaglutide; Placebo',
  'Alzheimers Disease', 'https://clinicaltrials.gov/study/NCT05891496', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'semaglutide'
where st.nct_id = 'NCT05891496'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT05891496'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07770282', 'Efficacy and Safety of Semaglutide Versus Placebo on Cardiometabolic Profile in Patients With Schizophrenia With Metabolic Syndrome', 'All India Institute of Medical Sciences, Bhubaneswar',
  'PHASE3', 'NOT_YET_RECRUITING', 'Semaglutide + TAU; Placebo + TAU',
  'Schizophrenia Disorder; Metabolic Syndrome; Antipsychotic-induced Weight Gain; Cardiovascular Risk; Insulin Resistance', 'https://clinicaltrials.gov/study/NCT07770282', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'semaglutide'
where st.nct_id = 'NCT07770282'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07770282'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT01387347', 'Safety and Efficacy of Thymosin Beta 4 Ophthalmic Solution in Patients With Dry Eye', 'ReGenTree, LLC',
  'PHASE2', 'COMPLETED', 'Thymosin beta 4; Placebo',
  'Dry Eye Syndrome; Dry Eye', 'https://clinicaltrials.gov/study/NCT01387347', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'thymosin-beta-4'
where st.nct_id = 'NCT01387347'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT01387347'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT00598871', 'A Phase 2 Study of the Safety and Efficacy of Thymosin Beta 4 for Treating Corneal Wounds', 'ReGenTree, LLC',
  'PHASE2', 'TERMINATED', 'Thymosin Beta 4 (Tβ4); Placebo',
  'Diabetes', 'https://clinicaltrials.gov/study/NCT00598871', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'thymosin-beta-4'
where st.nct_id = 'NCT00598871'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT00598871'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT00311766', 'A Phase 2 Study on Effect of Thymosin Beta 4 on Wound Healing in Patients With Epidermolysis Bullosa', 'RegeneRx Biopharmaceuticals, Inc.',
  'PHASE2', 'TERMINATED', 'Thymosin Beta 4; Placebo',
  'Epidermolysis Bullosa', 'https://clinicaltrials.gov/study/NCT00311766', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'thymosin-beta-4'
where st.nct_id = 'NCT00311766'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT00311766'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT00832091', 'Study of Thymosin Beta 4 in Patients With Venous Stasis Ulcers', 'RegeneRx Biopharmaceuticals, Inc.',
  'PHASE2', 'COMPLETED', 'Thymosin Beta 4; Placebo',
  'Venous Stasis Ulcers', 'https://clinicaltrials.gov/study/NCT00832091', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'thymosin-beta-4'
where st.nct_id = 'NCT00832091'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT00832091'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT00382174', 'Study of Thymosin Beta 4 in Patients With Pressure Ulcers', 'RegeneRx Biopharmaceuticals, Inc.',
  'PHASE2', 'COMPLETED', 'Placebo; Thymosin Beta 4',
  'Pressure Ulcers', 'https://clinicaltrials.gov/study/NCT00382174', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'thymosin-beta-4'
where st.nct_id = 'NCT00382174'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT00382174'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07191873', 'Tirzepatide in Idiopathic Intracranial Hypertension Trial', 'Duke University',
  'PHASE4', 'RECRUITING', 'Tirzepatide; Tirzepatide Placebo',
  'Idiopathic Intracranial Hypertension (IIH)', 'https://clinicaltrials.gov/study/NCT07191873', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'tirzepatide'
where st.nct_id = 'NCT07191873'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07191873'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07777575', 'Resistance Training to Prevent Muscle Loss During Treatment With Tirzepatide', 'Technical University of Munich',
  'PHASE4', 'NOT_YET_RECRUITING', 'Dual GIP/GLP-1 Receptor Agonist Tirzepatide; Resistance Training',
  'Obesity (BMI>30)', 'https://clinicaltrials.gov/study/NCT07777575', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'tirzepatide'
where st.nct_id = 'NCT07777575'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07777575'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07218445', 'The Effect of Tirzepatide on Menopausal Vasomotor Symptoms and Biological Aging in Post-menopausal Women With Obesity', 'Mayo Clinic',
  'PHASE4', 'RECRUITING', 'Tirzepatide; Placebo',
  'Obesity; Menopause Hot Flashes', 'https://clinicaltrials.gov/study/NCT07218445', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'tirzepatide'
where st.nct_id = 'NCT07218445'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07218445'
on conflict (study_id, source_id) do nothing;

insert into public.studies (
  nct_id, title, sponsor, phase, status, intervention, condition, source_url, review_status, has_results
) values (
  'NCT07734870', 'Tirzepatide for Treatment of CCCA', 'Johns Hopkins University',
  'PHASE2', 'NOT_YET_RECRUITING', 'Tirzepatide',
  'Central Centrifugal Cicatricial Alopecia (CCCA)', 'https://clinicaltrials.gov/study/NCT07734870', 'review-required', false
)
on conflict (nct_id) do nothing;

insert into public.study_substances (study_id, substance_id)
select st.id, sub.id
from public.studies st
join public.substances sub on sub.slug = 'tirzepatide'
where st.nct_id = 'NCT07734870'
on conflict (study_id, substance_id) do nothing;

insert into public.study_sources (study_id, source_id)
select st.id, s.id
from public.studies st
join public.sources s on s.nct_id = st.nct_id
where st.nct_id = 'NCT07734870'
on conflict (study_id, source_id) do nothing;

commit;
