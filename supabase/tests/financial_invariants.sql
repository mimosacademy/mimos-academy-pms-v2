-- Financial invariant regression tests (static/CI executable against a disposable Supabase DB).
-- These tests intentionally use SAVEPOINTs and expect invalid writes to fail.

begin;

-- Required schema objects.
do $$
begin
  if to_regclass('public.invoice') is null then raise exception 'Missing public.invoice'; end if;
  if to_regclass('public.payment') is null then raise exception 'Missing public.payment'; end if;
  if to_regclass('public.payment_status') is null then raise exception 'Missing public.payment_status'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_invoice_financial_invariants'
  ) then raise exception 'Missing invoice financial invariant trigger'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_payment_invariants'
  ) then raise exception 'Missing payment invariant trigger'; end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_sync_invoice_collection_from_payment'
  ) then raise exception 'Missing payment-to-invoice collection trigger'; end if;
end $$;

-- Required idempotency column/index.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='payment' and column_name='operation_id'
  ) then raise exception 'payment.operation_id is missing'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='ux_payment_operation_id'
  ) then raise exception 'ux_payment_operation_id is missing'; end if;
end $$;

rollback;
