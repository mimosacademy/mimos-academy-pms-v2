-- 048_masb_team_full_operational_access.sql
-- Business rule: MASB_TEAM is a full PMS operational role. It may create,
-- edit and delete normal business records, including financial records, but
-- must not receive Super Admin administration privileges (user approval,
-- user removal, role administration, or system/bulk administration).

begin;

drop policy if exists pms_insert on public.invoice;
create policy pms_insert on public.invoice for insert to authenticated
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_update on public.invoice;
create policy pms_update on public.invoice for update to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']))
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_delete on public.invoice;
create policy pms_delete on public.invoice for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_insert on public.payment;
create policy pms_insert on public.payment for insert to authenticated
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_update on public.payment;
create policy pms_update on public.payment for update to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']))
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_delete on public.payment;
create policy pms_delete on public.payment for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_insert on public.invoice_payment_allocation;
create policy pms_insert on public.invoice_payment_allocation for insert to authenticated
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_update on public.invoice_payment_allocation;
create policy pms_update on public.invoice_payment_allocation for update to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']))
with check (private.has_pms_role(array['SUPER_ADMIN','ADMIN','FINANCE','MASB_TEAM']));

drop policy if exists pms_delete on public.invoice_payment_allocation;
create policy pms_delete on public.invoice_payment_allocation for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.client;
create policy pms_delete on public.client for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.programme;
create policy pms_delete on public.programme for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.quotation;
create policy pms_delete on public.quotation for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.purchase_order;
create policy pms_delete on public.purchase_order for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.participant;
create policy pms_delete on public.participant for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']));

drop policy if exists pms_delete on public.document;
create policy pms_delete on public.document for delete to authenticated
using (private.has_pms_role(array['SUPER_ADMIN','ADMIN','MASB_TEAM']) and private.can_access_programme(programme_id));

commit;
