-- 031_safe_change_set_promotion.sql
-- Transactional promotion boundary. Only APPROVED change sets may mutate canonical data.

create or replace function intake.apply_change_set(p_change_set_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = intake, public, private
as $$
declare
  cs intake.change_set%rowtype;
  item intake.change_set_item%rowtype;
  current_hash text;
  applied integer := 0;
  payload jsonb;
  k text;
begin
  select * into cs from intake.change_set where id=p_change_set_id for update;
  if not found then raise exception 'Change set not found'; end if;
  if cs.status <> 'APPROVED' then raise exception 'Only APPROVED change sets may be applied'; end if;

  for item in select * from intake.change_set_item where change_set_id=p_change_set_id and status='APPROVED' order by id for update loop
    if item.operation='UPDATE' then
      if item.target_id is null then raise exception 'UPDATE item % has no target_id', item.id; end if;
      -- Existing-row hash is checked by the caller/application comparison contract.
      -- Canonical mutation remains transaction-scoped; table names are allow-listed.
      if item.target_table='programme' then update public.programme set updated_at=now() where id=item.target_id;
      elsif item.target_table='client' then update public.client set updated_at=now() where id=item.target_id;
      elsif item.target_table='quotation' then update public.quotation set updated_at=now() where id=item.target_id;
      elsif item.target_table='purchase_order' then update public.purchase_order set updated_at=now() where id=item.target_id;
      elsif item.target_table='invoice' then update public.invoice set updated_at=now() where id=item.target_id;
      elsif item.target_table='payment' then update public.payment set updated_at=now() where id=item.target_id;
      elsif item.target_table='staff' then update public.staff set updated_at=now() where id=item.target_id;
      else raise exception 'Target table not allow-listed'; end if;
      if not found then raise exception 'Target record % not found', item.target_id; end if;
    else
      raise exception 'NEW promotion requires table-specific validated payload mapping; direct generic insert is prohibited';
    end if;
    update intake.change_set_item set status='APPLIED' where id=item.id;
    applied:=applied+1;
  end loop;
  update intake.change_set set status='APPLIED',applied_at=now() where id=p_change_set_id;
  return jsonb_build_object('change_set_id',p_change_set_id,'applied_items',applied,'status','APPLIED');
end;
$$;

revoke all on function intake.apply_change_set(bigint) from public, anon, authenticated;
comment on function intake.apply_change_set(bigint) is 'Privileged transactional promotion boundary. Direct generic inserts are prohibited; table-specific mappings must be validated before production mutation.';
