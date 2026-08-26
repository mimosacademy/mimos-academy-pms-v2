-- 025_financial_amount_relationship_guards.sql
-- Enforce upstream commercial-value ceilings without relying on UI validation.

begin;

create or replace function private.enforce_po_financial_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  q_final numeric(18,2);
  q_total numeric(18,2);
  q_ceiling numeric(18,2);
  po_value numeric(18,2);
begin
  if new.quotation_id is null then return new; end if;

  select coalesce(final_price, total_price_incl_tax)
    into q_ceiling
  from public.quotation
  where id = new.quotation_id;

  po_value := coalesce(new.po_value_incl_tax, new.po_value_excl_tax);

  if q_ceiling is not null and po_value is not null and po_value > q_ceiling then
    if not public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']) then
      raise exception 'Purchase order value exceeds approved quotation value';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_po_financial_ceiling() from public;
drop trigger if exists trg_po_financial_ceiling on public.purchase_order;
create trigger trg_po_financial_ceiling
before insert or update of quotation_id, po_value_excl_tax, po_value_incl_tax
on public.purchase_order
for each row execute function private.enforce_po_financial_ceiling();

create or replace function private.enforce_invoice_financial_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  q_ceiling numeric(18,2);
  po_ceiling numeric(18,2);
  invoice_value numeric(18,2);
begin
  invoice_value := coalesce(new.total_incl_tax, new.amount_excl_tax);

  if new.quotation_id is not null then
    select coalesce(final_price, total_price_incl_tax)
      into q_ceiling
    from public.quotation where id = new.quotation_id;
    if q_ceiling is not null and invoice_value is not null and invoice_value > q_ceiling
       and not public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']) then
      raise exception 'Invoice value exceeds quotation value';
    end if;
  end if;

  if new.purchase_order_id is not null then
    select coalesce(po_value_incl_tax, po_value_excl_tax)
      into po_ceiling
    from public.purchase_order where id = new.purchase_order_id;
    if po_ceiling is not null and invoice_value is not null and invoice_value > po_ceiling
       and not public.has_pms_role(array['SUPER_ADMIN','ADMIN','MANAGER']) then
      raise exception 'Invoice value exceeds purchase order value';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_invoice_financial_ceiling() from public;
drop trigger if exists trg_invoice_financial_ceiling on public.invoice;
create trigger trg_invoice_financial_ceiling
before insert or update of quotation_id, purchase_order_id, amount_excl_tax, total_incl_tax
on public.invoice
for each row execute function private.enforce_invoice_financial_ceiling();

-- Financial values cannot be negative and, when both sides exist, tax-inclusive values
-- must not be below their tax-exclusive component.
create or replace function private.enforce_financial_amount_sanity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_table_name = 'quotation' then
    if coalesce(new.total_price_excl_tax,0) < 0 or coalesce(new.total_price_incl_tax,0) < 0
       or coalesce(new.final_price,0) < 0 then
      raise exception 'Quotation financial values cannot be negative';
    end if;
  elsif tg_table_name = 'purchase_order' then
    if coalesce(new.po_value_excl_tax,0) < 0 or coalesce(new.po_value_incl_tax,0) < 0 then
      raise exception 'Purchase order financial values cannot be negative';
    end if;
  elsif tg_table_name = 'invoice' then
    if coalesce(new.amount_excl_tax,0) < 0 or coalesce(new.sst_amount,0) < 0 or coalesce(new.total_incl_tax,0) < 0 then
      raise exception 'Invoice financial values cannot be negative';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_financial_amount_sanity() from public;

do $$
begin
  drop trigger if exists trg_quotation_financial_amount_sanity on public.quotation;
  create trigger trg_quotation_financial_amount_sanity before insert or update on public.quotation for each row execute function private.enforce_financial_amount_sanity();
  drop trigger if exists trg_po_financial_amount_sanity on public.purchase_order;
  create trigger trg_po_financial_amount_sanity before insert or update on public.purchase_order for each row execute function private.enforce_financial_amount_sanity();
  drop trigger if exists trg_invoice_financial_amount_sanity on public.invoice;
  create trigger trg_invoice_financial_amount_sanity before insert or update on public.invoice for each row execute function private.enforce_financial_amount_sanity();
end $$;

commit;
