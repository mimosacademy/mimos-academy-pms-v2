-- Financial relationship regression assertions.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_quotation_relationship_integrity') then raise exception 'quotation relationship trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_po_relationship_integrity') then raise exception 'PO relationship trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_invoice_relationship_integrity') then raise exception 'invoice relationship trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_payment_relationship_integrity') then raise exception 'payment relationship trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_po_financial_ceiling') then raise exception 'PO financial ceiling trigger missing'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_invoice_financial_ceiling') then raise exception 'invoice financial ceiling trigger missing'; end if;
  if not exists (select 1 from pg_class where relname='ux_quotation_number_revision' and relkind='i') then raise exception 'quotation uniqueness index missing'; end if;
  if not exists (select 1 from pg_class where relname='ux_purchase_order_number' and relkind='i') then raise exception 'PO uniqueness index missing'; end if;
end $$;
