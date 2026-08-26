-- 011_rls.sql

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'account_type','staff_role','sector','training_type','payment_method','payment_status','quotation_type','quotation_status','programme_status','project_status','opportunity_status','action_item_status','payment_terms','speed_to_market','programme_category','service_type','revenue_type',
    'staff','account','client','client_contact','programme','quotation','purchase_order','invoice','payment','invoice_payment_allocation','opportunity','action_item','training_stat','participant','training_delivery','document','audit_history',
    'source_file','import_batch','stg_raw_record','audit_log','data_conflict','completeness_score','staff_alias','client_alias','stg_invoice','stg_quotation','stg_funnel','stg_action_item','stg_training_stat','stg_cost_of_sales'
  ] LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
    EXECUTE format('drop policy if exists pms_select on public.%I',t);
    EXECUTE format('drop policy if exists pms_insert on public.%I',t);
    EXECUTE format('drop policy if exists pms_update on public.%I',t);
    EXECUTE format('drop policy if exists pms_delete on public.%I',t);
    EXECUTE format('create policy pms_select on public.%I for select to authenticated using (true)',t);
    EXECUTE format('create policy pms_insert on public.%I for insert to authenticated with check (public.is_staff())',t);
    EXECUTE format('create policy pms_update on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())',t);
    EXECUTE format('create policy pms_delete on public.%I for delete to authenticated using (public.is_admin())',t);
  END LOOP;
END $$;

drop policy if exists pms_select on public.audit_log;
create policy pms_select on public.audit_log for select to authenticated using (public.is_staff());
drop policy if exists pms_select on public.data_conflict;
create policy pms_select on public.data_conflict for select to authenticated using (public.is_staff());

drop policy if exists pms_insert on public.staff;
drop policy if exists pms_update on public.staff;
drop policy if exists pms_delete on public.staff;
create policy pms_insert on public.staff for insert to authenticated with check (public.is_admin());
create policy pms_update on public.staff for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pms_delete on public.staff for delete to authenticated using (public.is_admin());

grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
