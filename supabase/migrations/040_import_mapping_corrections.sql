-- 040_import_mapping_corrections.sql
-- Correct mappings against the authoritative financial schema.

update intake.field_mapping set target_field='company_name' where target_table='client' and source_field in ('name','client_name');
update intake.field_mapping set target_field='title' where target_table='programme' and source_field='programme_name';
update intake.field_mapping set target_field='quotation_no' where target_table='quotation' and source_field='quotation_number';
update intake.field_mapping set target_field='po_no' where target_table='purchase_order' and source_field='po_number';
update intake.field_mapping set target_field='invoice_no' where target_table='invoice' and source_field='invoice_number';
update intake.field_mapping set target_field='amount_excl_tax' where target_table='invoice' and source_field='total_amount';
update intake.field_mapping set target_field='payment_reference' where target_table='payment' and source_field='payment_reference';

-- Reject mappings that target columns not present in the canonical schema.
delete from intake.field_mapping fm
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema='public' and c.table_name=fm.target_table and c.column_name=fm.target_field
);

comment on table intake.field_mapping is 'Validated server-owned mapping from raw source fields to existing canonical PMS columns.';
