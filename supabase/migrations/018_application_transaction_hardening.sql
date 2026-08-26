-- 018_application_transaction_hardening.sql
-- Forward-only application transaction hardening.

begin;

-- Payment operation_id is the idempotency boundary. Existing rows are assigned
-- stable UUIDs before the column becomes mandatory for all future writes.
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

-- Legacy audit_history must not be writable from the browser. The authoritative
-- append-only audit_log is populated by database triggers.
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

-- Ensure the client cannot invoke the compatibility authorization helpers as
-- arbitrary RPC endpoints. They remain executable only through authenticated
-- policy evaluation, while their implementation is delegated to private
-- security-definer helpers where present.
revoke all on function public.current_staff_id() from anon;
revoke all on function public.current_staff_role() from anon;
revoke all on function public.has_pms_role(text[]) from anon;
revoke all on function public.can_access_programme(bigint) from anon;

grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.has_pms_role(text[]) to authenticated;
grant execute on function public.can_access_programme(bigint) to authenticated;

commit;
