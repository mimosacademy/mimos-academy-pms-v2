-- 021_financial_domain_invariants.sql
-- Forward-only financial integrity boundary for PMS V2.
-- Database remains authoritative for financial totals and lifecycle transitions.

begin;

-- Prevent direct manipulation of invoice collection/status fields.
create or replace function private.enforce_invoice_financial_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
 declare
  calculated_total numeric(14,2);
 begin
  calculated_total := coalesce(new.amount_excl_tax, 0) + coalesce(new.sst_amount, 0);

  if abs(coalesce(new.total_incl_tax, 0) - calculated_total) > 0.01 then
    raise exception 'Invoice total_incl_tax must equal amount_excl_tax + sst_amount';
  end if;

  if coalesce(new.amount_collected, 0) < 0 then
    raise exception 'Invoice amount_collected cannot be negative';
  end if;

  if coalesce(new.amount_collected, 0) > coalesce(new.total_incl_tax, 0) then
    raise exception 'Invoice amount_collected cannot exceed total_incl_tax';
  end if;

  new.amount_outstanding := greatest(coalesce(new.total_incl_tax, 0) - coalesce(new.amount_collected, 0), 0);

  if new.amount_collected = 0 then
    new.payment_status_id := (select id from public.payment_status where upper(code) = 'UNPAID' limit 1);
  elsif new.amount_collected >= new.total_incl_tax then
    new.payment_status_id := (select id from public.payment_status where upper(code) = 'PAID' limit 1);
  else
    new.payment_status_id := (select id from public.payment_status where upper(code) in ('PARTIAL','PARTIALLY_PAID') limit 1);
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_invoice_financial_invariants() from public;

-- Trigger name is deliberately unique so this migration is safe to rerun only through migration tooling.
drop trigger if exists trg_invoice_financial_invariants on public.invoice;
create trigger trg_invoice_financial_invariants
before insert or update of amount_excl_tax, sst_amount, total_incl_tax, amount_collected, payment_status_id
on public.invoice
for each row execute function private.enforce_invoice_financial_invariants();

-- Payment amounts must be positive. Invoice linkage is mandatory.
create or replace function private.enforce_payment_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
 declare
  invoice_total numeric(14,2);
  already_collected numeric(14,2);
 begin
  if new.invoice_id is null then
    raise exception 'Payment must be linked to an invoice';
  end if;

  if coalesce(new.amount, 0) <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select total_incl_tax into invoice_total
  from public.invoice
  where id = new.invoice_id;

  if invoice_total is null then
    raise exception 'Payment references a non-existent invoice';
  end if;

  select coalesce(sum(amount), 0) into already_collected
  from public.payment
  where invoice_id = new.invoice_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(payment_status_id, 0) <> (select id from public.payment_status where upper(code) = 'VOID' limit 1);

  if already_collected + new.amount > invoice_total then
    raise exception 'Payment would over-collect invoice';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_payment_invariants() from public;

drop trigger if exists trg_payment_invariants on public.payment;
create trigger trg_payment_invariants
before insert or update of invoice_id, amount, payment_status_id
on public.payment
for each row execute function private.enforce_payment_invariants();

-- Keep invoice collection derived from non-void payments.
create or replace function private.sync_invoice_collection_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
 declare
  target_invoice uuid;
  collected numeric(14,2);
 begin
  target_invoice := coalesce(new.invoice_id, old.invoice_id);

  if target_invoice is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(p.amount), 0)
    into collected
  from public.payment p
  where p.invoice_id = target_invoice
    and coalesce(p.payment_status_id, 0) <> (select id from public.payment_status where upper(code) = 'VOID' limit 1);

  update public.invoice
     set amount_collected = collected,
         updated_at = now()
   where id = target_invoice;

  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    select coalesce(sum(p.amount), 0) into collected
    from public.payment p
    where p.invoice_id = old.invoice_id
      and coalesce(p.payment_status_id, 0) <> (select id from public.payment_status where upper(code) = 'VOID' limit 1);
    update public.invoice set amount_collected = collected, updated_at = now() where id = old.invoice_id;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.sync_invoice_collection_from_payment() from public;

drop trigger if exists trg_sync_invoice_collection_from_payment on public.payment;
create trigger trg_sync_invoice_collection_from_payment
after insert or update of invoice_id, amount, payment_status_id or delete
on public.payment
for each row execute function private.sync_invoice_collection_from_payment();

-- State transitions: prevent impossible backward/terminal transitions from the browser.
create or replace function private.enforce_quotation_state_transition()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if old.status_id is distinct from new.status_id and private.has_pms_role('SUPER_ADMIN') = false then
    if exists (
      select 1 from public.quotation_status s_old
      join public.quotation_status s_new on true
      where s_old.id = old.status_id and s_new.id = new.status_id
        and upper(s_old.code) = 'ACCEPTED'
        and upper(s_new.code) <> 'ACCEPTED'
    ) then
      raise exception 'Accepted quotation cannot transition to another state';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quotation_state_transition on public.quotation;
create trigger trg_quotation_state_transition
before update of status_id on public.quotation
for each row execute function private.enforce_quotation_state_transition();

commit;
