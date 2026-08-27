-- 036_import_hash_and_concurrency.sql
-- Canonical hash contract used for optimistic concurrency during import promotion.

create extension if not exists pgcrypto;

create or replace function intake.payload_hash(p_payload jsonb)
returns text
language plpgsql
immutable
strict
as $$
declare
  s text;
  h bigint := 2166136261;
  c integer;
  i integer;
begin
  select coalesce(string_agg(format('%s:%s',e.key,lower(trim(both from coalesce(e.value #>> '{}','')))), '|' order by e.key),'')
    into s
  from jsonb_each(p_payload) e;
  for i in 1..length(s) loop
    c := ascii(substr(s,i,1));
    h := (h # c);
    h := (h * 16777619) % 4294967296;
  end loop;
  return lpad(to_hex(h),8,'0');
end;
$$;

revoke all on function intake.payload_hash(jsonb) from public,anon,authenticated;
grant execute on function intake.payload_hash(jsonb) to service_role;

create or replace function intake.canonical_row_hash(p_table text,p_id bigint)
returns text
language plpgsql
security definer
stable
set search_path=intake,public,pg_catalog
as $$
declare payload jsonb;
begin
  if p_table not in ('client','programme','quotation','purchase_order','invoice','payment') then raise exception 'Unsupported table'; end if;
  execute format('select to_jsonb(t) from public.%I t where t.id=$1',p_table) using p_id into payload;
  if payload is null then return null; end if;
  return intake.payload_hash(payload);
end;
$$;
revoke all on function intake.canonical_row_hash(text,bigint) from public,anon,authenticated;
grant execute on function intake.canonical_row_hash(text,bigint) to service_role;

-- Replace promotion with a real optimistic concurrency check.
create or replace function intake.apply_change_set(p_change_set_id bigint)
returns jsonb language plpgsql security definer set search_path=intake,public,private,pg_catalog as $$
declare cs intake.change_set%rowtype; item intake.change_set_item%rowtype; cols text; sets text; sql text; target_id bigint; affected integer; current_hash text; applied integer:=0; protected text[]:=array['id','created_at','updated_at','created_by','updated_by','source_file','source_row_number','import_batch_id'];
begin
 select * into cs from intake.change_set where id=p_change_set_id for update;
 if not found then raise exception 'Change set not found'; end if;
 if cs.status<>'APPROVED' then raise exception 'Only APPROVED change sets may be applied'; end if;
 for item in select * from intake.change_set_item where change_set_id=p_change_set_id and status='APPROVED' order by id for update loop
  if item.target_table not in ('client','programme','quotation','purchase_order','invoice','payment') then raise exception 'Target table not allow-listed'; end if;
  select string_agg(format('%I',m.target_field),', ' order by m.target_field), string_agg(format('t.%I = src.%I',m.target_field,m.target_field),', ' order by m.target_field) into cols,sets from intake.field_mapping m join pg_attribute a on a.attrelid=format('public.%s',item.target_table)::regclass and a.attname=m.target_field and a.attnum>0 and not a.attisdropped where m.target_table=item.target_table and m.target_field<>all(protected) and item.proposed_payload ? m.source_field;
  if cols is null then raise exception 'No approved mapped fields for item %',item.id; end if;
  if item.operation='UPDATE' then
   if item.target_id is null or item.expected_existing_hash is null then raise exception 'UPDATE item % missing concurrency identity',item.id; end if;
   current_hash:=intake.canonical_row_hash(item.target_table,item.target_id);
   if current_hash is null or current_hash<>item.expected_existing_hash then raise exception 'CONFLICT: canonical record changed since analysis'; end if;
   sql:=format('update public.%I t set %s, updated_at=now() from jsonb_populate_record(null::public.%I,$1) src where t.id=$2',item.target_table,sets,item.target_table);
   execute sql using item.proposed_payload,item.target_id; get diagnostics affected=row_count;
   if affected<>1 then raise exception 'UPDATE failed for item %',item.id; end if;
   target_id:=item.target_id;
  elsif item.operation='NEW' then
   sql:=format('insert into public.%I (%s,created_at,updated_at) select %s,now(),now() from jsonb_populate_record(null::public.%I,$1) src returning id',item.target_table,cols,cols,item.target_table);
   execute sql using item.proposed_payload into target_id; get diagnostics affected=row_count;
   if affected<>1 then raise exception 'NEW failed for item %',item.id; end if;
  else raise exception 'Unsupported promotion operation %',item.operation; end if;
  insert into intake.change_ledger(batch_id,record_id,target_table,target_id,operation,after_payload,changed_fields,decision_reason,confidence,decided_by) values(cs.batch_id,item.record_id,item.target_table,target_id,item.operation,item.proposed_payload,coalesce(item.proposed_payload->'changed_fields','[]'::jsonb),'Approved import change-set promotion',1,cs.approved_by);
  update intake.change_set_item set status='APPLIED',target_id=target_id where id=item.id; applied:=applied+1;
 end loop;
 update intake.change_set set status='APPLIED',applied_at=now() where id=p_change_set_id;
 return jsonb_build_object('change_set_id',p_change_set_id,'applied_items',applied,'status','APPLIED');
end;
$$;
revoke all on function intake.apply_change_set(bigint) from public,anon,authenticated;
grant execute on function intake.apply_change_set(bigint) to service_role;
