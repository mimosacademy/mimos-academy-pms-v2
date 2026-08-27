-- 036_change_set_apply_engine.sql
create or replace function intake.apply_change_set(p_change_set_id bigint)
returns jsonb language plpgsql security definer set search_path=intake,public,private,pg_catalog as $$
declare cs intake.change_set%rowtype; item intake.change_set_item%rowtype; cols text; sets text; sql text; affected bigint; applied integer:=0; table_name text; target_id bigint; protected text[]:=array['id','created_at','updated_at','created_by','updated_by','source_file','source_row_number','import_batch_id'];
begin
 select * into cs from intake.change_set where id=p_change_set_id for update;
 if not found then raise exception 'Change set not found'; end if;
 if cs.status<>'APPROVED' then raise exception 'Only APPROVED change sets may be applied'; end if;
 for item in select * from intake.change_set_item where change_set_id=p_change_set_id and status='APPROVED' order by id for update loop
  table_name:=item.target_table;
  if table_name not in ('client','programme','quotation','purchase_order','invoice','payment') then raise exception 'Target table is not allow-listed: %',table_name; end if;
  if item.proposed_payload is null or jsonb_typeof(item.proposed_payload)<>'object' then raise exception 'Invalid payload for item %',item.id; end if;
  select string_agg(format('%I',m.target_field),', ' order by m.target_field),string_agg(format('t.%I = src.%I',m.target_field,m.target_field),', ' order by m.target_field) into cols,sets from intake.field_mapping m join pg_attribute a on a.attrelid=format('public.%s',table_name)::regclass and a.attname=m.target_field and a.attnum>0 and not a.attisdropped where m.target_table=table_name and m.target_field<>all(protected) and item.proposed_payload ? m.source_field;
  if cols is null or sets is null then raise exception 'No approved mapped fields for item %',item.id; end if;
  if item.operation='UPDATE' then
   if item.target_id is null or item.expected_existing_hash is null then raise exception 'UPDATE item % missing concurrency identity',item.id; end if;
   sql:=format('update public.%I t set %s,updated_at=now() from jsonb_populate_record(null::public.%I,$1) src where t.id=$2 returning t.id',table_name,sets,table_name);
   execute sql using item.proposed_payload,item.target_id into target_id; get diagnostics affected=row_count;
   if affected<>1 then raise exception 'UPDATE target % not found',item.target_id; end if;
  elsif item.operation='NEW' then
   sql:=format('insert into public.%I (%s,created_at,updated_at) select %s,now(),now() from jsonb_populate_record(null::public.%I,$1) src returning id',table_name,cols,cols,table_name);
   execute sql using item.proposed_payload into target_id; get diagnostics affected=row_count;
   if affected<>1 then raise exception 'NEW insert failed for item %',item.id; end if;
  else raise exception 'Unsupported promotion operation %',item.operation; end if;
  insert into intake.change_ledger(batch_id,record_id,target_table,target_id,operation,after_payload,changed_fields,decision_reason,confidence,decided_by) values(cs.batch_id,item.record_id,table_name,target_id,item.operation,item.proposed_payload,coalesce(item.proposed_payload->'changed_fields','[]'::jsonb),'Approved import change-set promotion',1.0,cs.approved_by);
  update intake.change_set_item set status='APPLIED',target_id=target_id where id=item.id; applied:=applied+1;
 end loop;
 update intake.change_set set status='APPLIED',applied_at=now() where id=p_change_set_id;
 return jsonb_build_object('change_set_id',p_change_set_id,'applied_items',applied,'status','APPLIED');
end; $$;
revoke all on function intake.apply_change_set(bigint) from public,anon,authenticated;
grant execute on function intake.apply_change_set(bigint) to service_role;
