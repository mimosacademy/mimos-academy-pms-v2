-- Authoritative invoice accounting regression checks.
-- Static/schema assertions only; transaction tests require a seeded test database.

do $$
begin
  if to_regclass('public.invoice') is null then raise exception 'invoice table missing'; end if;
  if to_regclass('public.payment') is null then raise exception 'payment table missing'; end if;
  if to_regclass('public.payment_status') is null then raise exception 'payment_status table missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_guard_invoice_derived_accounting') then raise exception 'invoice derived-field guard trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_sync_invoice_from_payment') then raise exception 'payment-to-invoice accounting trigger missing'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='recalculate_invoice_accounting') then raise exception 'accounting function missing'; end if;
end $$;

select
  has_table_privilege('authenticated','public.invoice','UPDATE') as invoice_update_privilege,
  has_table_privilege('authenticated','public.payment','INSERT') as payment_insert_privilege;
