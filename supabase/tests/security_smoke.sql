-- PMS V2 security smoke test
-- Run against a disposable Supabase database after applying migrations.
-- This script is intentionally read-only and fails fast on structural regressions.

DO $$
declare n integer;
begin
  if not exists (select 1 from pg_class where relname='programme' and relrowsecurity) then
    raise exception 'programme RLS is not enabled';
  end if;
  if not exists (select 1 from pg_class where relname='invoice' and relrowsecurity) then
    raise exception 'invoice RLS is not enabled';
  end if;
  if not exists (select 1 from pg_class where relname='payment' and relrowsecurity) then
    raise exception 'payment RLS is not enabled';
  end if;
  if not exists (select 1 from pg_class where relname='audit_log' and relrowsecurity) then
    raise exception 'audit_log RLS is not enabled';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname='public'
    and tablename in ('client','client_contact','programme','quotation','purchase_order','invoice','payment','invoice_payment_allocation','opportunity','action_item','training_stat','participant','training_delivery','document','audit_history','completeness_score','staff')
    and coalesce(qual,'') in ('true','(true)');
  if n > 0 then raise exception 'Broad USING(true) policy remains on sensitive table(s): %', n; end if;

  if has_function_privilege('authenticated','public.promote_stg_invoice(bigint)','execute') then
    raise exception 'authenticated can execute promote_stg_invoice';
  end if;
  if has_function_privilege('authenticated','public.promote_stg_quotation(bigint)','execute') then
    raise exception 'authenticated can execute promote_stg_quotation';
  end if;
  if has_function_privilege('authenticated','public.promote_stg_funnel(bigint)','execute') then
    raise exception 'authenticated can execute promote_stg_funnel';
  end if;

  if has_table_privilege('authenticated','public.audit_log','insert') then raise exception 'authenticated can INSERT audit_log'; end if;
  if has_table_privilege('authenticated','public.audit_log','update') then raise exception 'authenticated can UPDATE audit_log'; end if;
  if has_table_privilege('authenticated','public.audit_log','delete') then raise exception 'authenticated can DELETE audit_log'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payment' and column_name='operation_id'
  ) then raise exception 'payment.operation_id is missing'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='ux_payment_operation_id'
  ) then raise exception 'ux_payment_operation_id is missing'; end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='pms_documents_select') then
    raise exception 'Storage select policy is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='pms_documents_insert') then
    raise exception 'Storage insert policy is missing';
  end if;

  raise notice 'PMS V2 structural security smoke test PASSED';
end $$;

-- Human/manual role tests must be run with controlled Supabase Auth accounts:
-- VIEWER: SELECT invoice/payment/allocation => denied.
-- PIC A: SELECT programme/document for PIC B's programme => denied.
-- FINANCE: INSERT valid payment => succeeds.
-- FINANCE: INSERT payment that exceeds invoice total => denied.
-- FINANCE: INSERT duplicate operation_id => denied.
-- FINANCE: INSERT allocation above payment amount => denied.
-- USER: update/delete audit_log => denied.
-- PIC A: read Storage object under programmes/{PIC B programme}/... => denied.
