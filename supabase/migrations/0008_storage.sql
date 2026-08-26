-- 0008_storage.sql
-- Private storage bucket for uploaded PDF product lists. Admin-only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdf-imports', 'pdf-imports', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- All objects must live under admin-uploads/ to make path guessing useless
-- and to keep room for future prefixes (e.g. per-import subfolders) without
-- a migration change.
create policy "pdf_imports_bucket_admin_select"
  on storage.objects for select
  using (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'admin-uploads'
  );

create policy "pdf_imports_bucket_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'admin-uploads'
  );

create policy "pdf_imports_bucket_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'pdf-imports'
    and public.has_role(auth.uid(), 'admin')
    and (storage.foldername(name))[1] = 'admin-uploads'
  );
