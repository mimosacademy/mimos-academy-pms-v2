-- 016_security_integrity_hardening.sql
-- PMS V2 remediation: replace broad role RLS, lock down audit/control-plane data,
-- enforce programme ownership, protect financial invariants, and scope storage.
-- NOTE: staging promotion remains service_role-only by 015_migration_function_security.sql.

create or replace function public.current_staff_id()
returns bigint
language sql stable security definer set search_path = public
as $$
  select s.id
  from public.staff s
  where s.auth_user_id = (select auth.uid())
    and s.is_active = true
  limit 1;
$$;

create or replace function public.has_pms_role(p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select upper(public.current_staff_role()) = any (
    select upper(x) from unnest(coalesce(p_roles, '{}'::text[])) x
  );
$$;

create or replace function public.can_access_programme(p_programme_id bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.programme p
    where p.id = p_programme_id
      and (
        public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
        or (public.has_pms_role(array['PIC','TRAINER']) and p.pic_id = public.current_staff_id())
      )
  );
$$;

revoke all on function public.current_staff_id() from public;
revoke all on function public.has_pms_role(text[]) from public;
revoke all on function public.can_access_programme(bigint) from public;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.has_pms_role(text[]) to authenticated;
grant execute on function public.can_access_programme(bigint) to authenticated;

-- Replace the unsafe pms_select/insert/update/delete policies created by 013.
do $$
declare t text;
begin
  foreach t in array array[
    'account','client','client_contact','programme','quotation','purchase_order',
    'invoice','payment','invoice_payment_allocation','opportunity','action_item',
    'training_stat','participant','training_delivery','document','audit_history',
    'completeness_score'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pms_select on public.%I', t);
    execute format('drop policy if exists pms_insert on public.%I', t);
    execute format('drop policy if exists pms_update on public.%I', t);
    execute format('drop policy if exists pms_delete on public.%I', t);
  end loop;
end $$;

-- Master data.
create policy pms_select on public.account for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM','PIC','TRAINER']));
create policy pms_insert on public.account for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_update on public.account for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_delete on public.account for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.client for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM','PIC','TRAINER']));
create policy pms_insert on public.client for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.client for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.client for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.client_contact for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM','PIC','TRAINER']));
create policy pms_insert on public.client_contact for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.client_contact for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.client_contact for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Programme is the primary domain boundary.
create policy pms_select on public.programme for select to authenticated
using (public.can_access_programme(id));
create policy pms_insert on public.programme for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.programme for update to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM'])
  or (public.has_pms_role(array['PIC','TRAINER']) and pic_id = public.current_staff_id())
)
with check (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM'])
  or (public.has_pms_role(array['PIC','TRAINER']) and pic_id = public.current_staff_id())
);
create policy pms_delete on public.programme for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Sales pipeline.
create policy pms_select on public.opportunity for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
  or (programme_id is not null and public.can_access_programme(programme_id))
);
create policy pms_insert on public.opportunity for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.opportunity for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.opportunity for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.quotation for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
  or (programme_id is not null and public.can_access_programme(programme_id))
);
create policy pms_insert on public.quotation for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.quotation for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.quotation for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.purchase_order for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
  or (programme_id is not null and public.can_access_programme(programme_id))
);
create policy pms_insert on public.purchase_order for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.purchase_order for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_delete on public.purchase_order for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Finance is deliberately narrower than general operational access.
create policy pms_select on public.invoice for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_insert on public.invoice for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_update on public.invoice for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_delete on public.invoice for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.payment for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_insert on public.payment for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_update on public.payment for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_delete on public.payment for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.invoice_payment_allocation for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));
create policy pms_insert on public.invoice_payment_allocation for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_update on public.invoice_payment_allocation for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE']));
create policy pms_delete on public.invoice_payment_allocation for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Programme-scoped operational records.
create policy pms_select on public.action_item for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
  or (programme_id is not null and public.can_access_programme(programme_id))
  or assigned_to_id = public.current_staff_id()
);
create policy pms_insert on public.action_item for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM']));
create policy pms_update on public.action_item for update to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM'])
  or assigned_to_id = public.current_staff_id()
)
with check (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','SALES','MASB_TEAM'])
  or assigned_to_id = public.current_staff_id()
);
create policy pms_delete on public.action_item for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.training_stat for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM'])
  or public.can_access_programme(programme_id)
);
create policy pms_insert on public.training_stat for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_update on public.training_stat for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_delete on public.training_stat for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.participant for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','MASB_TEAM','TRAINER'])
  and public.can_access_programme(programme_id)
);
create policy pms_insert on public.participant for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id));
create policy pms_update on public.participant for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']) and public.can_access_programme(programme_id));
create policy pms_delete on public.participant for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.training_delivery for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','SALES','MASB_TEAM','TRAINER'])
  or public.can_access_programme(programme_id)
);
create policy pms_insert on public.training_delivery for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_update on public.training_delivery for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM','TRAINER']));
create policy pms_delete on public.training_delivery for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

create policy pms_select on public.document for select to authenticated
using (
  public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM','TRAINER'])
  and public.can_access_programme(programme_id)
);
create policy pms_insert on public.document for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_update on public.document for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_delete on public.document for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']) and public.can_access_programme(programme_id));

-- Audit history is operational evidence, not a writable activity log.
create policy pms_select on public.audit_history for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM']) and (programme_id is null or public.can_access_programme(programme_id)));
create policy pms_insert on public.audit_history for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','MASB_TEAM']));
create policy pms_update on public.audit_history for update to authenticated
using (false) with check (false);
create policy pms_delete on public.audit_history for delete to authenticated
using (false);

-- Completeness scores are generated evidence. Users may read, never rewrite directly.
create policy pms_select on public.completeness_score for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','VIEWER','FINANCE','SALES','MASB_TEAM']) and public.can_access_programme(programme_id));
create policy pms_insert on public.completeness_score for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));
create policy pms_update on public.completeness_score for update to authenticated
using (false) with check (false);
create policy pms_delete on public.completeness_score for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Lookup tables are read-only to normal users; only admin can maintain them.
do $$
declare t text;
begin
  foreach t in array array[
    'account_type','staff_role','sector','training_type','payment_method','payment_status',
    'quotation_type','quotation_status','programme_status','project_status','opportunity_status',
    'action_item_status','payment_terms','speed_to_market','programme_category','service_type','revenue_type'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pms_select on public.%I', t);
    execute format('drop policy if exists pms_insert on public.%I', t);
    execute format('drop policy if exists pms_update on public.%I', t);
    execute format('drop policy if exists pms_delete on public.%I', t);
    execute format('create policy pms_select on public.%I for select to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'',''MANAGER'',''VIEWER'',''FINANCE'',''SALES'',''MASB_TEAM'',''PIC'',''TRAINER'']))', t);
    execute format('create policy pms_insert on public.%I for insert to authenticated with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_update on public.%I for update to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN''])) with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_delete on public.%I for delete to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
  end loop;
end $$;

-- Staff identity: a user can read only their own row; management can see the directory.
alter table public.staff enable row level security;
drop policy if exists pms_select on public.staff;
drop policy if exists pms_insert on public.staff;
drop policy if exists pms_update on public.staff;
drop policy if exists pms_delete on public.staff;
create policy pms_select on public.staff for select to authenticated
using (auth_user_id = auth.uid() or public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']));
create policy pms_insert on public.staff for insert to authenticated
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_update on public.staff for update to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']))
with check (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));
create policy pms_delete on public.staff for delete to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN']));

-- Import/control-plane data must never be exposed to ordinary application roles.
do $$
declare t text;
begin
  foreach t in array array[
    'source_file','import_batch','stg_raw_record','stg_invoice','stg_quotation','stg_funnel',
    'stg_action_item','stg_training_stat','stg_cost_of_sales','data_conflict','staff_alias','client_alias'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists pms_select on public.%I', t);
    execute format('drop policy if exists pms_insert on public.%I', t);
    execute format('drop policy if exists pms_update on public.%I', t);
    execute format('drop policy if exists pms_delete on public.%I', t);
    execute format('create policy pms_select on public.%I for select to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'',''MANAGER'']))', t);
    execute format('create policy pms_insert on public.%I for insert to authenticated with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_update on public.%I for update to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN''])) with check (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
    execute format('create policy pms_delete on public.%I for delete to authenticated using (public.has_pms_role(array[''SUPER_ADMIN'',''ADMIN'']))', t);
  end loop;
end $$;

-- Audit log: append-only. Application clients cannot insert/update/delete evidence.
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists pms_audit_select on public.audit_log;
create policy pms_audit_select on public.audit_log for select to authenticated
using (public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER','FINANCE']));

create or replace function private.write_audit_event()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values (tg_table_name,new.id,'*',null,to_jsonb(new)::text,'ROW','INSERT',auth.uid());
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values (tg_table_name,new.id,'*',to_jsonb(old)::text,to_jsonb(new)::text,'ROW','UPDATE',auth.uid());
  else
    insert into public.audit_log(table_name,record_id,field_name,old_value,new_value,change_type,action,performed_by_id)
    values (tg_table_name,old.id,'*',to_jsonb(old)::text,null,'ROW','DELETE',auth.uid());
  end if;
  return coalesce(new,old);
end;
$$;

revoke all on function private.write_audit_event() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['client','client_contact','programme','quotation','purchase_order','invoice','payment','invoice_payment_allocation','opportunity','action_item','training_stat','participant','training_delivery','document'] loop
    execute format('drop trigger if exists trg_pms_audit_%I on public.%I',t,t);
    execute format('create trigger trg_pms_audit_%I after insert or update or delete on public.%I for each row execute function private.write_audit_event()',t,t);
  end loop;
end $$;

-- Payment operation id prevents accidental replay of the same logical payment.
alter table public.payment add column if not exists operation_id uuid;
create unique index if not exists ux_payment_operation_id on public.payment(operation_id) where operation_id is not null;

-- Server-side financial invariant: payments cannot exceed invoice total.
create or replace function private.validate_payment_invariants()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare invoice_total numeric(18,2); existing_paid numeric(18,2);
begin
  if new.amount < 0 then raise exception 'Payment amount cannot be negative'; end if;
  select coalesce(total_incl_tax,0) into invoice_total
  from public.invoice where id = new.invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  select coalesce(sum(p.amount),0) into existing_paid
  from public.payment p
  where p.invoice_id = new.invoice_id
    and p.id <> coalesce(new.id,-1);
  if existing_paid + new.amount > invoice_total then
    raise exception 'Payment exceeds invoice total';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_payment_invariants on public.payment;
create trigger trg_validate_payment_invariants
before insert or update on public.payment
for each row execute function private.validate_payment_invariants();

-- Allocation invariant: allocated value cannot exceed either payment or invoice value.
create or replace function private.validate_allocation_invariants()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare payment_amount numeric(18,2); invoice_total numeric(18,2); payment_allocated numeric(18,2); invoice_allocated numeric(18,2);
begin
  select amount into payment_amount from public.payment where id = new.payment_id for update;
  select coalesce(total_incl_tax,0) into invoice_total from public.invoice where id = new.invoice_id for update;
  if payment_amount is null or invoice_total is null then raise exception 'Payment or invoice not found'; end if;
  select coalesce(sum(a.allocated_amount),0) into payment_allocated
  from public.invoice_payment_allocation a
  where a.payment_id = new.payment_id and a.id <> coalesce(new.id,-1);
  select coalesce(sum(a.allocated_amount),0) into invoice_allocated
  from public.invoice_payment_allocation a
  where a.invoice_id = new.invoice_id and a.id <> coalesce(new.id,-1);
  if payment_allocated + new.allocated_amount > payment_amount then raise exception 'Allocation exceeds payment amount'; end if;
  if invoice_allocated + new.allocated_amount > invoice_total then raise exception 'Invoice allocation exceeds invoice total'; end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_allocation_invariants on public.invoice_payment_allocation;
create trigger trg_validate_allocation_invariants
before insert or update on public.invoice_payment_allocation
for each row execute function private.validate_allocation_invariants();

-- Recompute invoice collection from payment rows instead of trusting browser aggregates.
create or replace function private.recalc_invoice_collection(p_invoice_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare collected numeric(18,2); total numeric(18,2);
begin
  select coalesce(sum(amount),0) into collected from public.payment where invoice_id = p_invoice_id;
  select coalesce(total_incl_tax,0) into total from public.invoice where id = p_invoice_id;
  update public.invoice
  set amount_collected = least(collected,total),
      amount_outstanding = greatest(total-collected,0),
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function private.trg_recalc_invoice_collection()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform private.recalc_invoice_collection(case when tg_op='DELETE' then old.invoice_id else new.invoice_id end);
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_recalc_invoice_collection on public.payment;
create trigger trg_recalc_invoice_collection
after insert or update or delete on public.payment
for each row execute function private.trg_recalc_invoice_collection();

-- Storage ownership follows programmes/{programme_id}/...
drop policy if exists pms_documents_select on storage.objects;
drop policy if exists pms_documents_insert on storage.objects;
drop policy if exists pms_documents_update on storage.objects;
drop policy if exists pms_documents_delete on storage.objects;
create policy pms_documents_select on storage.objects for select to authenticated
using (
  bucket_id='pms-documents'
  and (storage.foldername(name))[1]='programmes'
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_programme((storage.foldername(name))[2]::bigint)
);
create policy pms_documents_insert on storage.objects for insert to authenticated
with check (
  bucket_id='pms-documents'
  and (storage.foldername(name))[1]='programmes'
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_programme((storage.foldername(name))[2]::bigint)
);
create policy pms_documents_update on storage.objects for update to authenticated
using (
  bucket_id='pms-documents'
  and (storage.foldername(name))[1]='programmes'
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_programme((storage.foldername(name))[2]::bigint)
)
with check (
  bucket_id='pms-documents'
  and (storage.foldername(name))[1]='programmes'
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_programme((storage.foldername(name))[2]::bigint)
);
create policy pms_documents_delete on storage.objects for delete to authenticated
using (
  bucket_id='pms-documents'
  and public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER'])
  and (storage.foldername(name))[1]='programmes'
  and (storage.foldername(name))[2] ~ '^[0-9]+$'
  and public.can_access_programme((storage.foldername(name))[2]::bigint)
);

-- Explicitly disable broad access to the old public programme summary if present.
drop view if exists public.v_programme_summary;
create view public.v_programme_summary
with (security_invoker = true)
as
select id,programme_code,title,client_id,training_type_id,programme_category_id,programme_status_id,
       duration_days,no_of_pax,start_date,end_date,is_public_training,is_in_house,is_internal,
       account_manager_id,pic_id
from public.programme;
grant select on public.v_programme_summary to authenticated;
