-- 012_storage.sql

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pms-documents','pms-documents',false,52428800,array[
 'application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','image/png','image/jpeg','text/csv'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Private bucket layout:
-- programmes/{programme_id}/quotations/...
-- programmes/{programme_id}/purchase-orders/...
-- programmes/{programme_id}/invoices/...
-- programmes/{programme_id}/supporting-documents/...
-- imports/{import_batch_id}/original-files/...

alter table storage.objects enable row level security;

drop policy if exists pms_documents_select on storage.objects;
drop policy if exists pms_documents_insert on storage.objects;
drop policy if exists pms_documents_update on storage.objects;
drop policy if exists pms_documents_delete on storage.objects;

create policy pms_documents_select
on storage.objects for select to authenticated
using (bucket_id='pms-documents' and public.is_staff());

create policy pms_documents_insert
on storage.objects for insert to authenticated
with check (bucket_id='pms-documents' and public.is_staff());

create policy pms_documents_update
on storage.objects for update to authenticated
using (bucket_id='pms-documents' and public.is_staff())
with check (bucket_id='pms-documents' and public.is_staff());

create policy pms_documents_delete
on storage.objects for delete to authenticated
using (bucket_id='pms-documents' and public.is_admin());
