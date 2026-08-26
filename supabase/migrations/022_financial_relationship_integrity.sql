-- 022_financial_relationship_integrity.sql
-- Forward-only relationship integrity for the commercial-to-cash chain.
-- UI/API values are never trusted for cross-entity ownership.

begin;

-- Prevent a quotation from linking a programme belonging to a different client.
create or replace function private.enforce_quotation_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  programme_client_id bigint;
begin
  if new.programme_id is not null then
    select client_id into programme_client_id
    from public.programme
    where id = new.programme_id;

    if programme_client_id is null then
      raise exception 'Quotation references a non-existent programme';
    end if;

    if new.client_id <> programme_client_id then
      raise exception 'Quotation client must match programme client';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_quotation_relationship_integrity() from public;

drop trigger if exists trg_quotation_relationship_integrity on public.quotation;
create trigger trg_quotation_relationship_integrity
before insert or update of programme_id, client_id
on public.quotation
for each row execute function private.enforce_quotation_relationship_integrity();

-- PO must agree with its quotation when a quotation is supplied.
create or replace function private.enforce_po_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  q_programme_id bigint;
  q_client_id bigint;
begin
  if new.quotation_id is not null then
    select programme_id, client_id
      into q_programme_id, q_client_id
    from public.quotation
    where id = new.quotation_id;

    if q_client_id is null then
      raise exception 'Purchase order references a non-existent quotation';
    end if;

    if new.client_id <> q_client_id then
      raise exception 'Purchase order client must match quotation client';
    end if;

    if q_programme_id is not null and new.programme_id is distinct from q_programme_id then
      raise exception 'Purchase order programme must match quotation programme';
    end if;
  end if;

  if new.programme_id is not null then
    if not exists (
      select 1 from public.programme p
      where p.id = new.programme_id
        and p.client_id = new.client_id
    ) then
      raise exception 'Purchase order client must match programme client';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_po_relationship_integrity() from public;

drop trigger if exists trg_po_relationship_integrity on public.purchase_order;
create trigger trg_po_relationship_integrity
before insert or update of quotation_id, programme_id, client_id
on public.purchase_order
for each row execute function private.enforce_po_relationship_integrity();

-- Invoice must agree with its programme and optional upstream documents.
create or replace function private.enforce_invoice_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  programme_client_id bigint;
  q_programme_id bigint;
  q_client_id bigint;
  po_programme_id bigint;
  po_client_id bigint;
begin
  select client_id into programme_client_id
  from public.programme
  where id = new.programme_id;

  if programme_client_id is null then
    raise exception 'Invoice references a non-existent programme';
  end if;

  if new.client_id <> programme_client_id then
    raise exception 'Invoice client must match programme client';
  end if;

  if new.quotation_id is not null then
    select programme_id, client_id into q_programme_id, q_client_id
    from public.quotation where id = new.quotation_id;
    if q_client_id is null then
      raise exception 'Invoice references a non-existent quotation';
    end if;
    if q_client_id <> new.client_id then
      raise exception 'Invoice client must match quotation client';
    end if;
    if q_programme_id is not null and q_programme_id <> new.programme_id then
      raise exception 'Invoice programme must match quotation programme';
    end if;
  end if;

  if new.purchase_order_id is not null then
    select programme_id, client_id into po_programme_id, po_client_id
    from public.purchase_order where id = new.purchase_order_id;
    if po_client_id is null then
      raise exception 'Invoice references a non-existent purchase order';
    end if;
    if po_client_id <> new.client_id then
      raise exception 'Invoice client must match purchase order client';
    end if;
    if po_programme_id is not null and po_programme_id <> new.programme_id then
      raise exception 'Invoice programme must match purchase order programme';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_invoice_relationship_integrity() from public;

drop trigger if exists trg_invoice_relationship_integrity on public.invoice;
create trigger trg_invoice_relationship_integrity
before insert or update of programme_id, client_id, quotation_id, purchase_order_id
on public.invoice
for each row execute function private.enforce_invoice_relationship_integrity();

-- Payment programme/client linkage is derived from the invoice and cannot diverge.
create or replace function private.enforce_payment_relationship_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invoice_programme_id bigint;
  invoice_client_id bigint;
begin
  select programme_id, client_id into invoice_programme_id, invoice_client_id
  from public.invoice where id = new.invoice_id;

  if invoice_programme_id is null then
    raise exception 'Payment references a non-existent invoice';
  end if;

  if new.programme_id is distinct from invoice_programme_id then
    raise exception 'Payment programme must match invoice programme';
  end if;

  if new.client_id is distinct from invoice_client_id then
    raise exception 'Payment client must match invoice client';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_payment_relationship_integrity() from public;

drop trigger if exists trg_payment_relationship_integrity on public.payment;
create trigger trg_payment_relationship_integrity
before insert or update of invoice_id, programme_id, client_id
on public.payment
for each row execute function private.enforce_payment_relationship_integrity();

-- Business identifiers must not silently duplicate.
create unique index if not exists ux_quotation_number_revision
  on public.quotation (quotation_no, revision)
  where quotation_no is not null and quotation_no <> '';

create unique index if not exists ux_purchase_order_number
  on public.purchase_order (po_no)
  where po_no is not null and po_no <> '';

-- Invoice number uniqueness is already present in the base schema; retain its partial form.

commit;
