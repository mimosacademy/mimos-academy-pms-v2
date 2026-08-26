-- 024_business_state_transition_guards.sql
-- Enforce valid business lifecycle transitions at database boundary.

create or replace function public.guard_business_state_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_state text := upper(coalesce(old.status_code, old.status, ''));
  new_state text := upper(coalesce(new.status_code, new.status, ''));
  privileged boolean := public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']);
begin
  if tg_op <> 'UPDATE' or old_state = new_state or old_state = '' or new_state = '' then
    return new;
  end if;

  if privileged then return new; end if;

  if tg_table_name = 'quotation' then
    if not ((old_state='DRAFT' and new_state='SENT')
         or (old_state='SENT' and new_state in ('ACCEPTED','REJECTED','EXPIRED'))) then
      raise exception 'Invalid quotation state transition: % -> %', old_state, new_state;
    end if;
  elsif tg_table_name = 'purchase_order' then
    if not ((old_state='PENDING' and new_state in ('CONFIRMED','ON_HOLD'))
         or (old_state='ON_HOLD' and new_state='CONFIRMED')
         or (old_state='CONFIRMED' and new_state='CLOSED')) then
      raise exception 'Invalid purchase order state transition: % -> %', old_state, new_state;
    end if;
  elsif tg_table_name = 'invoice' then
    if not ((old_state='UNPAID' and new_state in ('PARTIAL','OVERDUE'))
         or (old_state='PARTIAL' and new_state in ('PAID','OVERDUE'))
         or (old_state='OVERDUE' and new_state in ('PARTIAL','PAID'))) then
      raise exception 'Invalid invoice state transition: % -> %', old_state, new_state;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_business_state_transition() from public;

-- These triggers intentionally use the existing status columns where present.
-- Installation is conditional to keep migration safe across schema revisions.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='quotation' and column_name='status') then
    drop trigger if exists trg_quotation_state_transition on public.quotation;
    create trigger trg_quotation_state_transition before update of status on public.quotation for each row execute function public.guard_business_state_transition();
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='purchase_order' and column_name='status') then
    drop trigger if exists trg_purchase_order_state_transition on public.purchase_order;
    create trigger trg_purchase_order_state_transition before update of status on public.purchase_order for each row execute function public.guard_business_state_transition();
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='invoice' and column_name='status') then
    drop trigger if exists trg_invoice_state_transition on public.invoice;
    create trigger trg_invoice_state_transition before update of status on public.invoice for each row execute function public.guard_business_state_transition();
  end if;
end $$;

comment on function public.guard_business_state_transition() is 'Database boundary for ordinary-user business lifecycle transitions; privileged roles may perform controlled overrides.';
