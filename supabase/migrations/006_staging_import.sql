-- 006_staging_import.sql

create table if not exists public.source_file (
  id bigint generated always as identity primary key,
  file_name varchar(255) not null, file_path varchar(500), file_hash varchar(64) not null, file_size_bytes bigint, file_type varchar(50),
  upload_date timestamptz not null default now(), uploaded_by_id bigint references public.staff(id) on delete set null, description text, is_processed boolean not null default false, processed_at timestamptz
);
create index idx_source_file_hash on public.source_file(file_hash); create index idx_source_file_name on public.source_file(file_name); create index idx_source_file_processed on public.source_file(is_processed);

create table if not exists public.import_batch (
  id bigint generated always as identity primary key,
  batch_code varchar(50) not null unique, source_file_id bigint references public.source_file(id) on delete set null,
  import_type varchar(50) not null, table_target varchar(100) not null, records_total integer not null default 0, records_inserted integer not null default 0, records_updated integer not null default 0, records_skipped integer not null default 0, records_failed integer not null default 0, records_in_review integer not null default 0,
  status varchar(50) not null default 'PENDING', start_time timestamptz, end_time timestamptz, notes text, error_log text, imported_by_id bigint references public.staff(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_import_batch_status on public.import_batch(status); create index idx_import_batch_type on public.import_batch(import_type); create index idx_import_batch_target on public.import_batch(table_target); create index idx_import_batch_source_file on public.import_batch(source_file_id);

-- Add lineage FKs after import_batch exists.
alter table public.account add constraint fk_account_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.staff add constraint fk_staff_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.client add constraint fk_client_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.client_contact add constraint fk_contact_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.programme add constraint fk_programme_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.quotation add constraint fk_quotation_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.purchase_order add constraint fk_po_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.invoice add constraint fk_invoice_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.payment add constraint fk_payment_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.opportunity add constraint fk_opportunity_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.action_item add constraint fk_action_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.training_stat add constraint fk_training_stat_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;
alter table public.participant add constraint fk_participant_import_batch foreign key(import_batch_id) references public.import_batch(id) on delete set null;

create table if not exists public.stg_invoice (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_no varchar(50), raw_company_name varchar(255), raw_title varchar(500), raw_revenue_type varchar(100), raw_start_date varchar(50), raw_end_date varchar(50), raw_quotation_no varchar(100), raw_po_no varchar(100), raw_po_value varchar(50), raw_invoice_no varchar(100), raw_invoice_value varchar(50), raw_sst_amount varchar(50), raw_total_value varchar(50), raw_amount_collected varchar(50), raw_invoice_date varchar(50), raw_payment_terms varchar(50), raw_due_date varchar(50), raw_days_outstanding varchar(50), raw_payment_method varchar(100), raw_payment_status varchar(50), raw_payment_date varchar(50), raw_account varchar(50), raw_status varchar(50), raw_account_manager varchar(100), raw_pic varchar(100), raw_remark text,
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_programme_id bigint, mapped_client_id bigint, mapped_invoice_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_invoice_batch on public.stg_invoice(import_batch_id); create index idx_stg_invoice_status on public.stg_invoice(validation_status); create index idx_stg_invoice_company on public.stg_invoice(raw_company_name); create index idx_stg_invoice_no on public.stg_invoice(raw_invoice_no);

create table if not exists public.stg_quotation (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_no varchar(50), raw_date varchar(50), raw_category varchar(100), raw_quotation_type varchar(100), raw_quotation_no varchar(100), raw_training_type varchar(100), raw_company varchar(255), raw_account_manager varchar(100), raw_project_title varchar(500), raw_pic_full_name varchar(100), raw_pic_contact varchar(50), raw_pic_email varchar(255), raw_duration_days varchar(50), raw_no_of_unit varchar(50), raw_unit_price_excl varchar(50), raw_unit_price_incl varchar(50), raw_total_price_excl varchar(50), raw_total_price_incl varchar(50), raw_sst_amount varchar(50), raw_discount_pct varchar(50), raw_final_price varchar(50), raw_status varchar(50), raw_payment_status varchar(50), raw_project_status varchar(50), raw_prepared_by varchar(100),
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_programme_id bigint, mapped_client_id bigint, mapped_quotation_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_quotation_batch on public.stg_quotation(import_batch_id); create index idx_stg_quotation_status on public.stg_quotation(validation_status); create index idx_stg_quotation_no on public.stg_quotation(raw_quotation_no); create index idx_stg_quotation_company on public.stg_quotation(raw_company);

create table if not exists public.stg_funnel (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_no varchar(50), raw_client varchar(255), raw_project varchar(500), raw_type varchar(100), raw_forecast_value varchar(50), raw_status varchar(100), raw_speed_to_market varchar(50), raw_probability varchar(50), raw_weighted_value varchar(50), raw_secured_value varchar(50), raw_remarks text, raw_sector varchar(100), raw_salesman varchar(100),
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_opportunity_id bigint, mapped_client_id bigint, mapped_programme_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_funnel_batch on public.stg_funnel(import_batch_id); create index idx_stg_funnel_status on public.stg_funnel(validation_status); create index idx_stg_funnel_client on public.stg_funnel(raw_client); create index idx_stg_funnel_project on public.stg_funnel(raw_project);

create table if not exists public.stg_action_item (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_client varchar(255), raw_service varchar(255), raw_action text, raw_person_in_charge varchar(100), raw_person_email varchar(255), raw_due_date varchar(50), raw_status varchar(50), raw_potential_revenue varchar(50), raw_aging_days varchar(50), raw_notes text, raw_created_by varchar(100), raw_created_at varchar(50), raw_updated_at varchar(50),
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_action_item_id bigint, mapped_client_id bigint, mapped_programme_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_action_batch on public.stg_action_item(import_batch_id); create index idx_stg_action_status on public.stg_action_item(validation_status); create index idx_stg_action_client on public.stg_action_item(raw_client);

create table if not exists public.stg_training_stat (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_no varchar(50), raw_date varchar(50), raw_training_name varchar(500), raw_company varchar(255), raw_type varchar(100), raw_duration varchar(50), raw_wafer_fab_workshop varchar(50), raw_wafer_fab_training varchar(50), raw_wafer_fab_total varchar(50), raw_fa_ma_workshop varchar(50), raw_fa_ma_training varchar(50), raw_fa_ma_total varchar(50), raw_ai_workshop varchar(50), raw_ai_training varchar(50), raw_ai_total varchar(50), raw_others_workshop varchar(50), raw_others_training varchar(50), raw_others_total varchar(50), raw_total_workshop varchar(50), raw_total_training varchar(50), raw_grand_total varchar(50), raw_bumiputera varchar(50), raw_non_bumiputera varchar(50), raw_total_charges varchar(50), raw_sst_amount varchar(50), raw_final_charges varchar(50),
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_programme_id bigint, mapped_training_stat_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_training_batch on public.stg_training_stat(import_batch_id); create index idx_stg_training_status on public.stg_training_stat(validation_status); create index idx_stg_training_company on public.stg_training_stat(raw_company); create index idx_stg_training_name on public.stg_training_stat(raw_training_name);

create table if not exists public.stg_cost_of_sales (
 id bigint generated always as identity primary key, import_batch_id bigint not null references public.import_batch(id) on delete cascade, source_file varchar(255) not null, source_row_number integer not null,
 raw_no varchar(50), raw_company varchar(255), raw_invoice_no varchar(100), raw_invoice_value varchar(50), raw_invoice_date varchar(50), raw_payment_date varchar(50), raw_collection varchar(50), raw_cost_of_sales varchar(50), raw_mimos_academy_cost varchar(50), raw_commission varchar(50), raw_bro_incentive varchar(50), raw_net_profit varchar(50), raw_profit_pct varchar(50), raw_revenue varchar(50), raw_account varchar(50), raw_remark text,
 validation_status varchar(50) not null default 'PENDING', validation_errors jsonb, mapped_programme_id bigint, mapped_invoice_id bigint, mapped_payment_id bigint, created_at timestamptz not null default now(), processed_at timestamptz, processed_by_id uuid references auth.users(id) on delete set null
);
create index idx_stg_cost_batch on public.stg_cost_of_sales(import_batch_id); create index idx_stg_cost_status on public.stg_cost_of_sales(validation_status); create index idx_stg_cost_company on public.stg_cost_of_sales(raw_company); create index idx_stg_cost_invoice on public.stg_cost_of_sales(raw_invoice_no);
