-- Allow admin uploads under areas/ and design-studio/ (vials, custom portals).
-- Previously insert was limited to desktop|tablet|mobile only (0065).

drop policy if exists site_design_admin_insert on storage.objects;

create policy site_design_admin_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-design'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] in (
      'desktop',
      'tablet',
      'mobile',
      'areas',
      'design-studio'
    )
  );
