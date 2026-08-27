-- 041_import_promotion_integrity.sql
-- Replace the unsafe generic promotion implementation from 036.
-- Enforces mapping source->target, required fields, optimistic concurrency,
-- duplicate guards and approved-change-set ownership before canonical mutation.

create or replace function intake.apply_change_set(p_change_set_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = intake, public, private, pg_catalog
as $$
declare
  cs intake.change_set%rowtype;
  item intake.change_set_item%rowtype;
  m record;
  current_row jsonb;
  current_hash text;
  canonical_payload jsonb;
  source_value text;
  transformed jsonb;
  target_id bigint;
  applied integer := 0;
  changed jsonb;
  sql text;
  affected integer;
begin
  select * into cs from intake.change_set where id=p_change_set_id for update;
  if not found then raise exception 'Change set not found'; end if;
  if cs.status <> 'APPROVED' then raise exception 'Only APPROVED change sets may be applied'; end if;
  if cs.approved_by is null then raise exception 'Approved change set has no approver'; end if;

  if not exists (
    select 1 from public.staff s
    join public.staff_role r on r.id=s.role_id
    where s.auth_user_id=cs.approved_by
      and s.is_active=true
      and upper(r.code) in ('SUPER_ADMIN','ADMIN','DATA_ADMIN')
  ) then
    raise exception 'Change set approver is not an active authorized data administrator';
  end if;

  if not intake.validate_change_set_approval(p_change_set_id) then
    raise exception 'Change set failed approval validation';
  end if;

  for item in
    select * from intake.change_set_item
    where change_set_id=p_change_set_id and status='APPROVED'
    order by id for update
  loop
    if item.target_table not in ('client','programme','quotation','purchase_order','invoice','payment') then
      raise exception 'Target table is not allow-listed: %', item.target_table;
    end if;
    if item.proposed_payload is null or jsonb_typeof(item.proposed_payload)<>'object' then
      raise exception 'Invalid payload for item %', item.id;
    end if;

    canonical_payload := '{}'::jsonb;

    -- Required means at least one source mapping for a required target field must be present.
    for m in
      select target_field, bool_or(required) as required
      from intake.field_mapping
      where target_table=item.target_table
      group by target_field
    loop
      if m.required and not exists (
        select 1 from intake.field_mapping fm
        where fm.target_table=item.target_table
          and fm.target_field=m.target_field
          and (item.proposed_payload ? fm.source_field)
          and nullif(btrim(item.proposed_payload->>fm.source_field),'') is not null
      ) then
        raise exception 'Required field % missing for item %', m.target_field, item.id;
      end if;
    end loop;

    -- Build canonical payload using the server-owned source->target mapping and transforms.
    for m in
      select fm.*
      from intake.field_mapping fm
      join pg_attribute a
        on a.attrelid=format('public.%s',item.target_table)::regclass
       and a.attname=fm.target_field
       and a.attnum>0 and not a.attisdropped
      where fm.target_table=item.target_table
        and item.proposed_payload ? fm.source_field
        and fm.target_field not in ('id','created_at','updated_at','created_by','updated_by','source_file','source_row_number','import_batch_id')
      order by fm.id
    loop
      source_value := item.proposed_payload->>m.source_field;
      if source_value is null then continue; end if;
      case upper(m.transform)
        when 'LOWER_TRIM' then transformed := to_jsonb(lower(btrim(source_value)));
        when 'TRIM' then transformed := to_jsonb(btrim(source_value));
        when 'INTEGER' then transformed := to_jsonb(source_value::bigint);
        when 'DECIMAL' then transformed := to_jsonb(source_value::numeric);
        when 'DATE' then transformed := to_jsonb(source_value::date);
        else raise exception 'Unsupported mapping transform % for %',m.transform,m.source_field;
      end case;
      canonical_payload := canonical_payload || jsonb_build_object(m.target_field, transformed);
    end loop;

    if canonical_payload='{}'::jsonb then
      raise exception 'No approved mapped fields for item %',item.id;
    end if;

    if item.operation='UPDATE' then
      if item.target_id is null or item.expected_existing_hash is null then
        raise exception 'UPDATE item % missing concurrency identity',item.id;
      end if;

      if item.target_table='programme' then select to_jsonb(t) into current_row from public.programme t where id=item.target_id for update;
      elsif item.target_table='client' then select to_jsonb(t) into current_row from public.client t where id=item.target_id for update;
      elsif item.target_table='quotation' then select to_jsonb(t) into current_row from public.quotation t where id=item.target_id for update;
      elsif item.target_table='purchase_order' then select to_jsonb(t) into current_row from public.purchase_order t where id=item.target_id for update;
      elsif item.target_table='invoice' then select to_jsonb(t) into current_row from public.invoice t where id=item.target_id for update;
      elsif item.target_table='payment' then select to_jsonb(t) into current_row from public.payment t where id=item.target_id for update;
      end if;
      if current_row is null then raise exception 'Canonical record % not found',item.target_id; end if;
      current_hash := encode(digest(current_row::text,'sha256'),'hex');
      if current_hash <> item.expected_existing_hash then
        update intake.change_set_item set status='CONFLICT' where id=item.id;
        raise exception 'IMPORT_CONFLICT for item %',item.id;
      end if;

      sql := format('update public.%I t set %s, updated_at=now() from jsonb_populate_record(null::public.%I,$1) src where t.id=$2',
                    item.target_table,
                    (select string_agg(format('%I = src.%I',key,key),', ') from jsonb_object_keys(canonical_payload) as key),
                    item.target_table);
      execute sql using canonical_payload,item.target_id;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception 'UPDATE target % not found',item.target_id; end if;
      target_id := item.target_id;

    elsif item.operation='NEW' then
      -- Explicit natural-key duplicate protection for the canonical business identifiers.
      if item.target_table='client' and exists(select 1 from public.client where lower(trim(company_name))=lower(trim(canonical_payload->>'company_name'))) then
        raise exception 'IMPORT_DUPLICATE: client company_name already exists';
      elsif item.target_table='programme' and exists(select 1 from public.programme where lower(trim(title))=lower(trim(canonical_payload->>'title')) and client_id=(canonical_payload->>'client_id')::bigint) then
        raise exception 'IMPORT_DUPLICATE: programme already exists';
      elsif item.target_table='quotation' and exists(select 1 from public.quotation where quotation_no=canonical_payload->>'quotation_no') then
        raise exception 'IMPORT_DUPLICATE: quotation_no already exists';
      elsif item.target_table='purchase_order' and exists(select 1 from public.purchase_order where po_no=canonical_payload->>'po_no') then
        raise exception 'IMPORT_DUPLICATE: po_no already exists';
      elsif item.target_table='invoice' and exists(select 1 from public.invoice where invoice_no=canonical_payload->>'invoice_no') then
        raise exception 'IMPORT_DUPLICATE: invoice_no already exists';
      elsif item.target_table='payment' and exists(select 1 from public.payment where payment_reference=canonical_payload->>'payment_reference') then
        raise exception 'IMPORT_DUPLICATE: payment_reference already exists';
      end if;

      sql := format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) returning id',
                    item.target_table,
                    (select string_agg(format('%I',key),', ') from jsonb_object_keys(canonical_payload) as key),
                    (select string_agg(format('src.%I',key),', ') from jsonb_object_keys(canonical_payload) as key),
                    item.target_table);
      execute sql using canonical_payload into target_id;
      get diagnostics affected=row_count;
      if affected<>1 then raise exception 'NEW insert failed for item %',item.id; end if;
    else
      raise exception 'Unsupported promotion operation %',item.operation;
    end if;

    changed := coalesce(canonical_payload->'changed_fields','[]'::jsonb);
    insert into intake.change_ledger(batch_id,record_id,target_table,target_id,operation,after_payload,changed_fields,decision_reason,confidence,decided_by)
    values(cs.batch_id,item.record_id,item.target_table,target_id,item.operation,canonical_payload,changed,'Approved import change-set promotion',1.0,cs.approved_by);
    update intake.change_set_item set status='APPLIED',target_id=target_id where id=item.id;
    applied := applied+1;
  end loop;

  update intake.change_set set status='APPLIED',applied_at=now() where id=p_change_set_id;
  return jsonb_build_object('change_set_id',p_change_set_id,'applied_items',applied,'status','APPLIED');
end;
$$;

revoke all on function intake.apply_change_set(bigint) from public,anon,authenticated;
grant execute on function intake.apply_change_set(bigint) to service_role;

comment on function intake.apply_change_set(bigint) is 'Privileged import promotion: mapping-driven canonicalization, required-field validation, duplicate guards, optimistic concurrency and authorized approval boundary.';
