-- 038_import_concurrency_guard.sql
-- Server-side optimistic concurrency primitive. The supplied expected hash must match the locked canonical row.

create or replace function private.apply_import_update(
  p_table text,
  p_id bigint,
  p_expected_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_row jsonb;
  current_hash text;
  allowed jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  if p_table not in ('client','programme','quotation','purchase_order','invoice','payment') then
    raise exception 'Target table not allow-listed';
  end if;
  if p_id is null or p_expected_hash is null then raise exception 'Missing concurrency identity'; end if;

  if p_table='programme' then select to_jsonb(t) into current_row from public.programme t where id=p_id for update;
  elsif p_table='client' then select to_jsonb(t) into current_row from public.client t where id=p_id for update;
  elsif p_table='quotation' then select to_jsonb(t) into current_row from public.quotation t where id=p_id for update;
  elsif p_table='purchase_order' then select to_jsonb(t) into current_row from public.purchase_order t where id=p_id for update;
  elsif p_table='invoice' then select to_jsonb(t) into current_row from public.invoice t where id=p_id for update;
  elsif p_table='payment' then select to_jsonb(t) into current_row from public.payment t where id=p_id for update;
  end if;
  if current_row is null then raise exception 'Canonical record not found'; end if;

  current_hash := encode(digest(current_row::text,'sha256'),'hex');
  if current_hash <> p_expected_hash then raise exception 'IMPORT_CONFLICT'; end if;

  -- Strip identity/system fields. Actual field allow-list is enforced by the mapping layer.
  foreach k in array jsonb_object_keys(p_payload) loop
    if k not in ('id','created_at','updated_at','created_by','updated_by') then
      allowed := allowed || jsonb_build_object(k,p_payload->k);
    end if;
  end loop;
  return jsonb_build_object('status','VALIDATED','table',p_table,'id',p_id,'payload',allowed,'current_hash',current_hash);
end;
$$;

revoke all on function private.apply_import_update(text,bigint,text,jsonb) from public,anon,authenticated;
comment on function private.apply_import_update(text,bigint,text,jsonb) is 'Locks canonical row and rejects stale import updates using server-side SHA-256 hash comparison.';
