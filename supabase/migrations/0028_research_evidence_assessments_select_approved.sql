-- 0028_research_evidence_assessments_select_approved.sql
-- Phase 6B: do not edit 0026. SELECT-only policy replacement.
-- Admin (has_role): every evidence_assessment, including review-required.
-- Other authenticated: only review_status = approved on an approved claim.
-- Anon: no policy and no GRANT (0026). Writes stay admin-only from 0026.

drop policy if exists "evidence_assessments_select_authenticated" on public.evidence_assessments;

create policy "evidence_assessments_select_authenticated"
  on public.evidence_assessments for select to authenticated
  using (
    auth.uid() is not null and (
      public.has_role(auth.uid(), 'admin')
      or (
        review_status = 'approved'
        and exists (
          select 1
          from public.claims c
          where c.id = claim_id
            and c.status = 'approved'
        )
      )
    )
  );

comment on policy "evidence_assessments_select_authenticated" on public.evidence_assessments is
  'Admins see all assessments. Other authenticated users only see approved assessments on approved claims.';
