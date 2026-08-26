-- 023_authoritative_invoice_accounting.sql
-- Financial integrity boundary: invoice collection/status are derived from payment transactions.
-- Direct browser updates to derived accounting fields are rejected.

create or replace function public.guard_invoice_derived_accounting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.amount_collected is distinct from old.amount_collected
       or new.amount_outstanding is distinct from old.amount_outstanding
       or new.payment_status_id is distinct from old.payment_status_id
       or new.payment_date is distinct from old.payment_date then
      if coalesce(current_setting('pms.accounting_internal', true), 'off') <> 'on'
         and not public.has_pms_role(array['SUPER_ADMIN','ADMIN']) then
        raise exception 'Invoice collection, outstanding balance, payment status and payment date are derived from payment transactions';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_invoice_derived_accounting() from public;

drop trigger if exists trg_guard_invoice_derived_accounting on public.invoice;
create trigger trg_guard_invoice_derived_accounting
before update on public.invoice
for each row execute function public.guard_invoice_derived_accounting();

create or replace function public.recalculate_invoice_accounting(p_invoice_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(18,2);
  v_collected numeric(18,2);
  v_outstanding numeric(18,2);
  v_status_id bigint;
  v_paid_status_id bigint;
  v_partial_status_id bigint;
  v_unpaid_status_id bigint;
  v_payment_date date;
begin
  select total_incl_tax into v_total from public.invoice where id = p_invoice_id for update;
  if not found then return; end if;

  select coalesce(sum(amount), 0), max(payment_date)
    into v_collected, v_payment_date
  from public.payment
  where invoice_id = p_invoice_id
    and coalesce(payment_status_id::text, '') not in (
      select id::text from public.payment_status where upper(coalesce(code,name,'')) in ('VOID','CANCELLED')
    );

  v_collected := greatest(0, v_collected);
  v_outstanding := greatest(0, coalesce(v_total, 0) - v_collected);

  select id into v_paid_status_id from public.payment_status where upper(coalesce(code,name,'')) = 'PAID' limit 1;
  select id into v_partial_status_id from public.payment_status where upper(coalesce(code,name,'')) in ('PARTIAL','PARTIALLY PAID') limit 1;
  select id into v_unpaid_status_id from public.payment_status where upper(coalesce(code,name,'')) in ('UNPAID','PENDING') limit 1;

  if v_total is not null and v_collected >= v_total then
    v_status_id := v_paid_status_id;
  elsif v_collected > 0 then
    v_status_id := v_partial_status_id;
  else
    v_status_id := v_unpaid_status_id;
  end if;

  perform set_config('pms.accounting_internal', 'on', true);
  update public.invoice
     set amount_collected = v_collected,
         amount_outstanding = v_outstanding,
         payment_status_id = coalesce(v_status_id, payment_status_id),
         payment_date = v_payment_date,
         updated_at = now()
   where id = p_invoice_id;
  perform set_config('pms.accounting_internal', 'off', true);
end;
$$;

revoke all on function public.recalculate_invoice_accounting(bigint) from public;

create or replace function public.sync_invoice_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_invoice_accounting(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_invoice_from_payment() from public;

drop trigger if exists trg_sync_invoice_from_payment on public.payment;
create trigger trg_sync_invoice_from_payment
after insert or update or delete on public.payment
for each row execute function public.sync_invoice_from_payment();

-- Only the application roles that can create payment transactions receive execution.
grant execute on function public.recalculate_invoice_accounting(bigint) to authenticated;

-- Prevent ordinary clients from directly changing the authoritative accounting columns.
-- INSERT is permitted only with zero/default derived values; subsequent accounting is payment-driven.
drop trigger if exists trg_guard_invoice_derived_accounting_insert on public.invoice;
create or replace function public.guard_invoice_derived_accounting_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.amount_collected,0) <> 0
     or coalesce(new.amount_outstanding,0) <> 0
     or new.payment_date is not null then
    if not public.has_pms_role(array['SUPER_ADMIN','ADMIN']) then
      raise exception 'Derived invoice accounting fields must start at zero and are populated from payments';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_invoice_derived_accounting_insert() from public;
create trigger trg_guard_invoice_derived_accounting_insert
before insert on public.invoice
for each row execute function public.guard_invoice_derived_accounting_insert();

comment on function public.recalculate_invoice_accounting(bigint) is 'Authoritative invoice accounting recalculation from non-void payment transactions; callable only as a controlled internal operation.';
