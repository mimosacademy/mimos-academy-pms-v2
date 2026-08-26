-- 015_security_integrity_hardening.sql
-- PMS V2 remediation: default-deny RLS, privilege-gated SECURITY DEFINER,
-- server-side financial invariants, append-only audit log, secure views and storage.

create or replace function public.current_staff_id()
returns bigint language sql stable security definer set search_path=public
as $$
  select s.id from public.staff s
  where s.auth_user_id = (select auth.uid()) and s.is_active = true limit 1;
$$;

create or replace function public.has_pms_role(p_roles text[])
returns boolean language sql stable security definer set search_path=public
as $$
  select upper(public.current_staff_role()) = any(select upper(x) from unnest(coalesce(p_roles,'{}'::text[])) x);
$$;

create or replace function public.can_access_programme(p_programme_id bigint)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.programme p
    where p.id = p_programme_id
      and (
        public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER'])
        or (public.has_pms_role(array['FINANCE','SALES','MASB_TEAM']) and p.id is not null)
        or (public.has_pms_role(array['PIC']) and p.pic_id = public.current_staff_id())
        or (public.has_pms_role(array['TRAINER']) and p.pic_id = public.current_staff_id())
      )
  );
$$;

revoke all on function public.current_staff_id() from public;
revoke all on function public.has_pms_role(text[]) from public;
revoke all on function public.can_access_programme(bigint) from public;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.has_pms_role(text[]) to authenticated;
grant execute on function public.can_access_programme(bigint) to authenticated;

-- Default deny for sensitive operational tables. Policies below are explicit.
do $$
declare t text;
begin
  foreach t in array array[
    'client','client_contact','programme','quotation','purchase_order','invoice','payment',
    'invoice_payment_allocation','opportunity','action_item','training_stat','participant',
    'training_delivery','document','audit_history','completeness_score'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pms_select on public.%I', t);
    execute format('drop policy if exists pms_insert on public.%I', t);
    execute format('drop policy if exists pms_update on public.%I', t);
    execute format('drop policy if exists pms_delete on public.%I', t);
  end loop;
end $$;

-- Clients.
create policy pms_select on public.client for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM','PIC']));
create policy pms_insert on public.client for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']));
create policy pms_update on public.client for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']));
create policy pms_delete on public.client for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.client_contact for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM','PIC']));
create policy pms_insert on public.client_contact for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']));
create policy pms_update on public.client_contact for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']));
create policy pms_delete on public.client_contact for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

-- Programme.
create policy pms_select on public.programme for select to authenticated
using (public.can_access_programme(id));
create policy pms_insert on public.programme for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.programme for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']) or (public.has_pms_role(array['PIC']) and pic_id = public.current_staff_id()))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']) or (public.has_pms_role(array['PIC']) and pic_id = public.current_staff_id()));
create policy pms_delete on public.programme for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

-- Sales pipeline and quotations.
create policy pms_select on public.opportunity for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM','FINANCE'])
       or (public.has_pms_role(array['PIC']) and public.can_access_programme(programme_id)));
create policy pms_insert on public.opportunity for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.opportunity for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.opportunity for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.quotation for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM','FINANCE'])
       or (programme_id is not null and public.can_access_programme(programme_id)));
create policy pms_insert on public.quotation for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.quotation for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.quotation for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.purchase_order for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM','FINANCE'])
       or public.can_access_programme(programme_id));
create policy pms_insert on public.purchase_order for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.purchase_order for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.purchase_order for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

-- Finance: invoices/payments are never exposed to generic authenticated users.
create policy pms_select on public.invoice for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']) or public.has_pms_role(array['SALES']) and public.can_access_programme(programme_id));
create policy pms_insert on public.invoice for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_update on public.invoice for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_delete on public.invoice for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));

create policy pms_select on public.payment for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_insert on public.payment for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_update on public.payment for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_delete on public.payment for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));

create policy pms_select on public.invoice_payment_allocation for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_insert on public.invoice_payment_allocation for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_update on public.invoice_payment_allocation for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_delete on public.invoice_payment_allocation for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));

-- Programme-scoped operational data.
create policy pms_select on public.action_item for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM','FINANCE']) or public.can_access_programme(programme_id));
create policy pms_insert on public.action_item for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.action_item for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']) or (assigned_to_id = public.current_staff_id()))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']) or (assigned_to_id = public.current_staff_id()));
create policy pms_delete on public.action_item for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.training_stat for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','FINANCE','SALES']) or public.can_access_programme(programme_id));
create policy pms_insert on public.training_stat for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_update on public.training_stat for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_delete on public.training_stat for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.participant for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id));
create policy pms_insert on public.participant for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id));
create policy pms_update on public.participant for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id));
create policy pms_delete on public.participant for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.training_delivery for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER','SALES']) or public.can_access_programme(programme_id));
create policy pms_insert on public.training_delivery for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_update on public.training_delivery for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_delete on public.training_delivery for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));

create policy pms_select on public.document for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_insert on public.document for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_update on public.document for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_delete on public.document for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']) and public.can_access_programme(programme_id));

-- Audit and completeness are not user-editable evidence.
create policy pms_select on public.audit_history for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']));
create policy pms_select on public.completeness_score for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) or public.can_access_programme(programme_id));

-- Lookup tables are read-only to authenticated users; writes stay admin-only.
do $$
declare t text;
begin
  foreach t in array array['account_type','staff_role','sector','training_type','payment_method','payment_status','quotation_type','quotation_status','programme_status','project_status','opportunity_status','action_item_status','payment_terms','speed_to_market','programme_category','service_type','revenue_type'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pms_select on public.%I', t);
    execute format('drop policy if exists pms_insert on public.%I', t);
    execute format('drop policy if exists pms_update on public.%I', t);
    execute format('drop policy if exists pms_delete on public.%I', t);
    execute format('create policy pms_select on public.%I for select to authenticated using (true)', t);
    execute format('create policy pms_insert on public.%I for insert to authenticated with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_update on public.%I for update to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN''])) with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_delete on public.%I for delete to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
  end loop;
end $$;

-- Staff identity: users may read their own profile; management can read staff directory.
alter table public.staff enable row level security;
drop policy if exists pms_select on public.staff;
drop policy if exists pms_insert on public.staff;
drop policy if exists pms_update on public.staff;
drop policy if exists pms_delete on public.staff;
create policy pms_select on public.staff for select to authenticated
using (auth_user_id = auth.uid() or public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));
create policy pms_insert on public.staff for insert to authenticated with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_update on public.staff for update to authenticated using (public.has_pms_role(array['SUPER_ADMIN','ADMIN'])) with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_delete on public.staff for delete to authenticated using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Harden privileged functions. They remain callable through the client only after an explicit role check inside the function.
revoke all on function public.promote_stg_invoice(bigint) from public, authenticated;
revoke all on function public.promote_stg_quotation(bigint) from public, authenticated;
revoke all on function public.promote_stg_funnel(bigint) from public, authenticated;
grant execute on function public.promote_stg_invoice(bigint) to authenticated;
grant execute on function public.promote_stg_quotation(bigint) to authenticated;
grant execute on function public.promote_stg_funnel(bigint) to authenticated;

create or replace function public.promote_stg_invoice(p_batch_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; inserted_count integer:=0;
begin
  if not public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']) then raise exception 'Not authorized'; end if;
  for r in select * from public.stg_invoice where import_batch_id=p_batch_id and validation_status in ('VALID','READY','APPROVED') and mapped_client_id is not null and mapped_programme_id is not null and mapped_invoice_id is null order by id loop
    insert into public.invoice(invoice_no,programme_id,client_id,invoice_date,due_date,amount_excl_tax,sst_amount,total_incl_tax,amount_collected,amount_outstanding,days_outstanding,quotation_no_ref,po_no_ref,source_file,source_row_number,import_batch_id,created_by,updated_by)
    values(NULLIF(trim(r.raw_invoice_no),''),r.mapped_programme_id,r.mapped_client_id,NULLIF(r.raw_invoice_date,'')::date,NULLIF(r.raw_due_date,'')::date,NULLIF(regexp_replace(coalesce(r.raw_invoice_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_sst_amount,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_total_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),coalesce(NULLIF(regexp_replace(coalesce(r.raw_amount_collected,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0),coalesce(NULLIF(regexp_replace(coalesce(r.raw_total_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0)-coalesce(NULLIF(regexp_replace(coalesce(r.raw_amount_collected,''),'[^0-9.\-]','','g'),'')::numeric(18,2),0),0),NULLIF(r.raw_days_outstanding,'')::integer,NULLIF(r.raw_quotation_no,''),NULLIF(r.raw_po_no,''),r.source_file,r.source_row_number,p_batch_id,auth.uid(),auth.uid());
    inserted_count:=inserted_count+1;
  end loop;
  update public.import_batch set records_inserted=records_inserted+inserted_count,updated_at=now() where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'table','invoice','inserted',inserted_count);
end;$$;

create or replace function public.promote_stg_quotation(p_batch_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  if not public.has_pms_role(array['SUPER_ADMIN','ADMIN','SALES','MANAGER']) then raise exception 'Not authorized'; end if;
  for r in select * from public.stg_quotation where import_batch_id=p_batch_id and validation_status in ('VALID','READY','APPROVED') and mapped_client_id is not null and mapped_quotation_id is null order by id loop
    insert into public.quotation(quotation_no,client_id,programme_id,project_title,duration_days,no_of_unit,unit_price_excl_tax,unit_price_incl_tax,total_price_excl_tax,total_price_incl_tax,sst_amount,discount_percentage,final_price,quotation_date,valid_until,pic_full_name,pic_contact_no,pic_email,source_file,source_row_number,import_batch_id,created_by,updated_by)
    values(NULLIF(trim(r.raw_quotation_no),''),r.mapped_client_id,r.mapped_programme_id,r.raw_project_title,NULLIF(r.raw_duration_days,'')::numeric(5,2),NULLIF(r.raw_no_of_unit,'')::integer,NULLIF(regexp_replace(coalesce(r.raw_unit_price_excl,''),'[^0-9.\-]','','g'),'')::numeric(15,4),NULLIF(regexp_replace(coalesce(r.raw_unit_price_incl,''),'[^0-9.\-]','','g'),'')::numeric(15,4),NULLIF(regexp_replace(coalesce(r.raw_total_price_excl,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_total_price_incl,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_sst_amount,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_discount_pct,''),'[^0-9.\-]','','g'),'')::numeric(5,2),NULLIF(regexp_replace(coalesce(r.raw_final_price,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(r.raw_date,'')::date,NULLIF(r.raw_date,'')::date,r.raw_pic_full_name,r.raw_pic_contact,r.raw_pic_email,r.source_file,r.source_row_number,p_batch_id,auth.uid(),auth.uid());
    n:=n+1;
  end loop;
  update public.import_batch set records_inserted=records_inserted+n,updated_at=now() where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'table','quotation','inserted',n);
end;$$;

create or replace function public.promote_stg_funnel(p_batch_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  if not public.has_pms_role(array['SUPER_ADMIN','ADMIN','SALES','MANAGER']) then raise exception 'Not authorized'; end if;
  for r in select * from public.stg_funnel where import_batch_id=p_batch_id and validation_status in ('VALID','READY','APPROVED') and mapped_client_id is not null and mapped_opportunity_id is null order by id loop
    insert into public.opportunity(client_id,programme_id,project_title,forecast_value,probability_percentage,weighted_value,secured_value,remarks,source_file,source_row_number,import_batch_id,created_by,updated_by)
    values(r.mapped_client_id,r.mapped_programme_id,r.raw_project,NULLIF(regexp_replace(coalesce(r.raw_forecast_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_probability,''),'[^0-9.\-]','','g'),'')::numeric(5,2),NULLIF(regexp_replace(coalesce(r.raw_weighted_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),NULLIF(regexp_replace(coalesce(r.raw_secured_value,''),'[^0-9.\-]','','g'),'')::numeric(18,2),r.raw_remarks,r.source_file,r.source_row_number,p_batch_id,auth.uid(),auth.uid());
    n:=n+1;
  end loop;
  update public.import_batch set records_inserted=records_inserted+n,updated_at=now() where id=p_batch_id;
  return jsonb_build_object('batch_id',p_batch_id,'table','opportunity','inserted',n);
end;$$;

-- Financial invariants.
alter table public.payment add column if not exists operation_id uuid default gen_random_uuid();
create unique index if not exists ux_payment_operation_id on public.payment(operation_id) where operation_id is not null;

create or replace function private.validate_payment_invariants()
returns trigger language plpgsql security definer set search_path=public as $$
declare invoice_total numeric(18,2); existing_paid numeric(18,2);
begin
  if new.amount < 0 then raise exception 'Payment amount cannot be negative'; end if;
  select coalesce(total_incl_tax,0) into invoice_total from public.invoice where id=new.invoice_id for update;
  if invoice_total is null then raise exception 'Invoice not found'; end if;
  select coalesce(sum(p.amount),0) into existing_paid from public.payment p
  where p.invoice_id=new.invoice_id and p.id<>coalesce(new.id,-1)
    and not exists(select 1 from public.payment_status ps where ps.id=p.payment_status_id and ps.code='CANCELLED');
  if existing_paid + new.amount > invoice_total then raise exception 'Payment exceeds invoice outstanding amount'; end if;
  return new;
end; $$;

drop trigger if exists trg_validate_payment_invariants on public.payment;
create trigger trg_validate_payment_invariants before insert or update on public.payment for each row execute function private.validate_payment_invariants();

create or replace function private.validate_allocation_invariants()
returns trigger language plpgsql security definer set search_path=public as $$
declare payment_amount numeric(18,2); invoice_total numeric(18,2); payment_allocated numeric(18,2); invoice_allocated numeric(18,2);
begin
  select amount into payment_amount from public.payment where id=new.payment_id for update;
  select total_incl_tax into invoice_total from public.invoice where id=new.invoice_id for update;
  if payment_amount is null or invoice_total is null then raise exception 'Payment or invoice not found'; end if;
  select coalesce(sum(a.allocated_amount),0) into payment_allocated from public.invoice_payment_allocation a where a.payment_id=new.payment_id and a.id<>coalesce(new.id,-1);
  select coalesce(sum(a.allocated_amount),0) into invoice_allocated from public.invoice_payment_allocation a where a.invoice_id=new.invoice_id and a.id<>coalesce(new.id,-1);
  if payment_allocated + new.allocated_amount > payment_amount then raise exception 'Allocation exceeds payment amount'; end if;
  if invoice_allocated + new.allocated_amount > invoice_total then raise exception 'Invoice allocation exceeds invoice total'; end if;
  return new;
end; $$;

drop trigger if exists trg_validate_allocation_invariants on public.invoice_payment_allocation;
create trigger trg_validate_allocation_invariants before insert or update on public.invoice_payment_allocation for each row execute function private.validate_allocation_invariants();

-- Recalculate invoice collection from payment rows; do not trust client-supplied aggregates.
create or replace function private.recalc_invoice_collection(p_invoice_id bigint)
returns void language plpgsql security definer set search_path=public as $$
declare collected numeric(18,2); total numeric(18,2);
begin
  select coalesce(sum(p.amount),0) into collected from public.payment p where p.invoice_id=p_invoice_id and not exists(select 1 from public.payment_status ps where ps.id=p.payment_status_id and ps.code='CANCELLED');
  select coalesce(total_incl_tax,0) into total from public.invoice where id=p_invoice_id;
  update public.invoice set amount_collected=least(collected,total), amount_outstanding=greatest(total-collected,0) where id=p_invoice_id;
end; $$;

create or replace function private.trg_recalc_invoice_collection() returns trigger language plpgsql as $$
begin perform private.recalc_invoice_collection(case when tg_op='DELETE' then old.invoice_id else new.invoice_id end); return coalesce(new,old); end; $$;
drop trigger if exists trg_recalc_invoice_collection on public.payment;
create trigger trg_recalc_invoice_collection after insert or update or delete on public.payment for each row execute function private.trg_recalc_invoice_collection();

-- Append-only audit evidence. Application roles cannot mutate audit_log directly.
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;
create policy pms_audit_select on public.audit_log for select to authenticated using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));

create or replace function private.write_audit_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values(tg_table_name,new.id,'*',null,to_jsonb(new)::text,'ROW','INSERT',auth.uid());
  elsif tg_op='UPDATE' then
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values(tg_table_name,new.id,'*',to_jsonb(old)::text,to_jsonb(new)::text,'ROW','UPDATE',auth.uid());
  elsif tg_op='DELETE' then
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values(tg_table_name,old.id,'*',to_jsonb(old)::text,null,'ROW','DELETE',auth.uid());
  end if;
  return coalesce(new,old);
end; $$;

do $$ declare t text; begin
  foreach t in array array['client','programme','quotation','purchase_order','invoice','payment','invoice_payment_allocation','opportunity','action_item'] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I',t,t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function private.write_audit_event()',t,t);
  end loop;
end $$;

-- Views must obey underlying RLS.
do $$ declare v text; begin
  foreach v in array array['v_r1_income_statement','v_r2_training_stats','v_r3_funnel_pipeline','v_programme_completeness','v_financial_dashboard','v_action_item_dashboard','v_payment_collection','v_staff_performance'] loop
    begin execute format('alter view public.%I set (security_invoker = true)',v); exception when others then null; end;
  end loop;
end $$;

-- Storage: programme ownership is encoded in the path: programmes/{programme_id}/...
drop policy if exists pms_documents_select on storage.objects;
drop policy if exists pms_documents_insert on storage.objects;
drop policy if exists pms_documents_update on storage.objects;
drop policy if exists pms_documents_delete on storage.objects;
create policy pms_documents_select on storage.objects for select to authenticated
using (bucket_id='pms-documents' and case when (storage.foldername(name))[1]='programmes' and (storage.foldername(name))[2] ~ '^[0-9]+$' then public.can_access_programme((storage.foldername(name))[2]::bigint) else public.has_pms_role(array['SUPER_ADMIN','ADMIN']) end);
create policy pms_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='pms-documents' and (storage.foldername(name))[1]='programmes' and (storage.foldername(name))[2] ~ '^[0-9]+$' and public.can_access_programme((storage.foldername(name))[2]::bigint));
create policy pms_documents_update on storage.objects for update to authenticated
using (bucket_id='pms-documents' and (storage.foldername(name))[1]='programmes' and (storage.foldername(name))[2] ~ '^[0-9]+$' and public.can_access_programme((storage.foldername(name))[2]::bigint))
with check (bucket_id='pms-documents' and (storage.foldername(name))[1]='programmes' and (storage.foldername(name))[2] ~ '^[0-9]+$' and public.can_access_programme((storage.foldername(name))[2]::bigint));
create policy pms_documents_delete on storage.objects for delete to authenticated
using (bucket_id='pms-documents' and public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']) and (storage.foldername(name))[1]='programmes' and (storage.foldername(name))[2] ~ '^[0-9]+$' and public.can_access_programme((storage.foldername(name))[2]::bigint));

-- Viewer-safe programme summary. This projection intentionally contains no financial columns.
create or replace view public.v_programme_summary as
select p.id,p.programme_code,p.title,p.client_id,p.training_type_id,p.programme_category_id,p.programme_status_id,
       p.duration_days,p.no_of_pax,p.start_date,p.end_date,p.is_public_training,p.is_in_house,p.is_internal,
       p.account_manager_id,p.pic_id
from public.programme p;

grant select on public.v_programme_summary to authenticated;
