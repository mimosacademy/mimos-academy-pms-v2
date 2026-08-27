-- 041_change_set_promotion_integrity.sql
-- Correct authoritative import promotion.

create or replace function intake.apply_change_set(p_change_set_id bigint)
returns jsonb language plpgsql security definer
set search_path = intake, pg_catalog, public, private
as $$
declare
  cs intake.change_set%rowtype; item intake.change_set_item%rowtype; m record;
  current_row jsonb; mapped jsonb; payload jsonb; val text; cols text; sets text; sql text;
  target_id bigint; affected integer; applied integer:=0; duplicate_found boolean; current_hash text;
  protected text[]:=array['id','created_at','updated_at','created_by','updated_by','source_file','source_row_number','import_batch_id'];
begin
  select * into cs from intake.change_set where id=p_change_set_id for update;
  if not found then raise exception 'Change set not found'; end if;
  if cs.status<>'APPROVED' or cs.approved_by is null then raise exception 'Only APPROVED change sets with an approver may be applied'; end if;
  if not exists (select 1 from public.staff s join public.staff_role r on r.id=s.role_id where s.auth_user_id=cs.approved_by and s.is_active and r.code in ('SUPER_ADMIN','ADMIN','DATA_ADMIN')) then raise exception 'Invalid change-set approver'; end if;

  for item in select * from intake.change_set_item where change_set_id=p_change_set_id and status='APPROVED' order by id for update loop
    if item.target_table not in ('client','programme','quotation','purchase_order','invoice','payment') then raise exception 'Target table is not allow-listed: %',item.target_table; end if;
    if jsonb_typeof(item.proposed_payload)<>'object' then raise exception 'Invalid payload for item %',item.id; end if;

    mapped:='{}'::jsonb;
    for m in select source_field,target_field,required,transform from intake.field_mapping where target_table=item.target_table and target_field<>all(protected) order by id loop
      if m.required and (not (item.proposed_payload ? m.source_field) or nullif(trim(item.proposed_payload->>m.source_field),'') is null) then raise exception 'Required source field missing for item %: %',item.id,m.source_field; end if;
      if item.proposed_payload ? m.source_field and item.proposed_payload->>m.source_field is not null then
        val:=item.proposed_payload->>m.source_field;
        if upper(m.transform)='TRIM' then mapped:=mapped||jsonb_build_object(m.target_field,trim(val));
        elsif upper(m.transform)='LOWER_TRIM' then mapped:=mapped||jsonb_build_object(m.target_field,lower(trim(val)));
        elsif upper(m.transform)='INTEGER' then mapped:=mapped||jsonb_build_object(m.target_field,to_jsonb(val::bigint));
        elsif upper(m.transform)='DECIMAL' then mapped:=mapped||jsonb_build_object(m.target_field,to_jsonb(val::numeric));
        elsif upper(m.transform)='DATE' then mapped:=mapped||jsonb_build_object(m.target_field,to_jsonb(val::date));
        else raise exception 'Unsupported mapping transform %',m.transform; end if;
      end if;
    end loop;
    if mapped='{}'::jsonb then raise exception 'No approved mapped fields for item %',item.id; end if;
    payload:=mapped;

    if item.operation='UPDATE' then
      if item.target_id is null or item.expected_existing_hash is null then raise exception 'UPDATE item % missing concurrency identity',item.id; end if;
      if item.target_table='programme' then select to_jsonb(t) into current_row from public.programme t where id=item.target_id for update;
      elsif item.target_table='client' then select to_jsonb(t) into current_row from public.client t where id=item.target_id for update;
      elsif item.target_table='quotation' then select to_jsonb(t) into current_row from public.quotation t where id=item.target_id for update;
      elsif item.target_table='purchase_order' then select to_jsonb(t) into current_row from public.purchase_order t where id=item.target_id for update;
      elsif item.target_table='invoice' then select to_jsonb(t) into current_row from public.invoice t where id=item.target_id for update;
      elsif item.target_table='payment' then select to_jsonb(t) into current_row from public.payment t where id=item.target_id for update; end if;
      if current_row is null then raise exception 'Canonical record not found'; end if;
      current_hash:=private.canonical_json_hash(current_row);
      if current_hash<>item.expected_existing_hash then update intake.change_set_item set status='CONFLICT' where id=item.id; raise exception 'IMPORT_CONFLICT'; end if;
      select string_agg(format('%I',key),', ' order by key),string_agg(format('t.%I = src.%I',key,key),', ' order by key) into cols,sets from jsonb_object_keys(payload) as k(key);
      sql:=format('update public.%I t set %s, updated_at=now() from jsonb_populate_record(null::public.%I,$1) src where t.id=$2',item.target_table,sets,item.target_table);
      execute sql using payload,item.target_id; get diagnostics affected=row_count; if affected<>1 then raise exception 'UPDATE target not found'; end if; target_id:=item.target_id;
    elsif item.operation='NEW' then
      duplicate_found:=false;
      if item.target_table='client' then
        if payload ? 'registration_number' then select exists(select 1 from public.client where lower(trim(registration_number))=lower(trim(payload->>'registration_number'))) into duplicate_found; end if;
        if not duplicate_found and payload ? 'company_name' then select exists(select 1 from public.client where lower(trim(company_name))=lower(trim(payload->>'company_name'))) into duplicate_found; end if;
      elsif item.target_table='programme' and payload ? 'title' and payload ? 'client_id' then select exists(select 1 from public.programme where lower(trim(title))=lower(trim(payload->>'title')) and client_id=(payload->>'client_id')::bigint) into duplicate_found;
      elsif item.target_table='quotation' and payload ? 'quotation_no' then select exists(select 1 from public.quotation where lower(trim(quotation_no))=lower(trim(payload->>'quotation_no'))) into duplicate_found;
      elsif item.target_table='purchase_order' and payload ? 'po_no' then select exists(select 1 from public.purchase_order where lower(trim(po_no))=lower(trim(payload->>'po_no'))) into duplicate_found;
      elsif item.target_table='invoice' and payload ? 'invoice_no' then select exists(select 1 from public.invoice where lower(trim(invoice_no))=lower(trim(payload->>'invoice_no'))) into duplicate_found;
      elsif item.target_table='payment' and payload ? 'payment_reference' then select exists(select 1 from public.payment where lower(trim(payment_reference))=lower(trim(payload->>'payment_reference'))) into duplicate_found; end if;
      if duplicate_found then update intake.change_set_item set status='CONFLICT' where id=item.id; raise exception 'IMPORT_DUPLICATE'; end if;
      select string_agg(format('%I',key),', ' order by key) into cols from jsonb_object_keys(payload) as k(key);
      sql:=format('insert into public.%I (%s,created_at,updated_at) select %s,now(),now() from jsonb_populate_record(null::public.%I,$1) src returning id',item.target_table,cols,cols,item.target_table);
      execute sql using payload into target_id;
    else raise exception 'Unsupported promotion operation %',item.operation; end if;

    insert into intake.change_ledger(batch_id,record_id,target_table,target_id,operation,after_payload,changed_fields,decision_reason,confidence,decided_by)
    values(cs.batch_id,item.record_id,item.target_table,target_id,item.operation,payload,coalesce(item.proposed_payload->'changed_fields','[]'::jsonb),'Approved import change-set promotion',1.0,cs.approved_by);
    update intake.change_set_item set status='APPLIED',target_id=target_id where id=item.id; applied:=applied+1;
  end loop;
  update intake.change_set set status='APPLIED',applied_at=now() where id=p_change_set_id;
  return jsonb_build_object('change_set_id',p_change_set_id,'applied_items',applied,'status','APPLIED');
end; $$;

revoke all on function intake.apply_change_set(bigint) from public,anon,authenticated;
grant execute on function intake.apply_change_set(bigint) to service_role;
