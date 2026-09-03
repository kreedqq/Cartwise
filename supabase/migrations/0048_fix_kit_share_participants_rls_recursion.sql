-- 0048_fix_kit_share_participants_rls_recursion.sql
--
-- Production postgres logs: "infinite recursion detected in policy for
-- relation kit_share_participants" on GET /rest/v1/kit_shares and
-- /rest/v1/kit_share_participants (HTTP 500).
--
-- Cause: kit_share_participants_select_same_kit uses EXISTS (SELECT … FROM
-- kit_share_participants …). That subquery re-applies the same RLS policy.
-- kit_shares_select_participant also SELECTs kit_share_participants, so both
-- REST reads fail — including admin, even though kit_shares_select_admin and
-- kit_share_participants_select_admin already exist.
--
-- Same pattern as public.has_role(): a SECURITY DEFINER helper evaluates the
-- identical membership check without recursive RLS. Visibility is unchanged:
-- a user still only sees kits they created or participate in; admins still
-- see all rows via the existing admin policies. No grants on INSERT/UPDATE/
-- DELETE. No new tables. No snapshot or price changes.

create or replace function public.user_participates_in_kit_share(_kit_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kit_share_participants
    where kit_share_id = _kit_share_id
      and user_id = auth.uid()
  );
$$;

comment on function public.user_participates_in_kit_share(uuid) is
  'SECURITY DEFINER helper for kit-share SELECT policies. Avoids infinite RLS recursion on kit_share_participants. Does not broaden visibility.';

revoke all on function public.user_participates_in_kit_share(uuid) from public;
grant execute on function public.user_participates_in_kit_share(uuid) to authenticated;

drop policy if exists "kit_share_participants_select_same_kit" on public.kit_share_participants;
create policy "kit_share_participants_select_same_kit"
  on public.kit_share_participants
  for select
  to authenticated
  using (public.user_participates_in_kit_share(kit_share_id));

drop policy if exists "kit_shares_select_participant" on public.kit_shares;
create policy "kit_shares_select_participant"
  on public.kit_shares
  for select
  to authenticated
  using (
    creator_user_id = auth.uid()
    or public.user_participates_in_kit_share(id)
  );
