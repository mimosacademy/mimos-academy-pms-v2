-- 033_import_mapping_rules.sql
-- Explicit allow-listed field mapping for the data intelligence pipeline.

create schema if not exists intake;
create table if not exists intake.field_mapping (
  id bigint generated always as identity primary key,
  target_table text not null,
  source_field text not null,
  target_field text not null,
  required boolean not null default false,
  transform text not null default 'TRIM',
  unique(target_table,source_field)
);

insert into intake.field_mapping(target_table,source_field,target_field,required,transform) values
('client','client_id','client_id',false,'TRIM'),('client','name','client_name',true,'TRIM'),('client','client_name','client_name',true,'TRIM'),('client','email','email',false,'LOWER_TRIM'),
('programme','programme_id','id',false,'INTEGER'),('programme','programme_name','programme_name',true,'TRIM'),('programme','client_id','client_id',true,'INTEGER'),('programme','start_date','start_date',false,'DATE'),('programme','end_date','end_date',false,'DATE'),
('quotation','quotation_id','id',false,'INTEGER'),('quotation','quotation_number','quotation_number',true,'TRIM'),('quotation','programme_id','programme_id',true,'INTEGER'),
('purchase_order','po_number','po_number',true,'TRIM'),('purchase_order','programme_id','programme_id',true,'INTEGER'),
('invoice','invoice_id','id',false,'INTEGER'),('invoice','invoice_number','invoice_number',true,'TRIM'),('invoice','programme_id','programme_id',true,'INTEGER'),('invoice','total_amount','total_amount',true,'DECIMAL'),
('payment','payment_id','id',false,'INTEGER'),('payment','payment_reference','payment_reference',true,'TRIM'),('payment','invoice_id','invoice_id',true,'INTEGER'),('payment','amount','amount',true,'DECIMAL')
on conflict(target_table,source_field) do update set target_field=excluded.target_field,required=excluded.required,transform=excluded.transform;

alter table intake.field_mapping enable row level security;
revoke all on intake.field_mapping from anon,authenticated;
comment on table intake.field_mapping is 'Explicit allow-list preventing arbitrary raw-file columns from becoming database columns.';
