-- 019_application_transaction_hardening.sql
-- Production already contains security-policy-private-helpers as migration 018.
-- This forward migration therefore owns only the remaining transaction boundary.

begin;

-- Payment operation_id is the idempotency boundary. Backfill existing records,
-- then make the invariant mandatory for all future writes.
alter table public.payment
  add column if not exists operation_id uuid;

update public.payment
set operation_id = gen_random_uuid()
where operation_id is null;

alter table public.payment
  alter column operation_id set default gen_random_uuid(),
  alter column operation_id set not null;

create unique index if not exists ux_payment_operation_id
  on public.payment(operation_id);

-- audit_log is the authoritative append-only evidence store. audit_history is
-- legacy UI history and must not be client-writable because browser users could
-- otherwise forge activity records.
alter table public.audit_history enable row level security;
drop policy if exists pms_insert on public.audit_history;
drop policy if exists pms_update on public.audit_history;
drop policy if exists pms_delete on public.audit_history;

create policy pms_insert on public.audit_history
for insert to authenticated
with check (false);

create policy pms_update on public.audit_history
for update to authenticated
using (false)
with check (false);

create policy pms_delete on public.audit_history
for delete to authenticated
using (false);

commit;
