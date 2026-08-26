-- 005_operations_tables.sql

create table if not exists public.opportunity (
  id bigint generated always as identity primary key,
  opportunity_code varchar(50), client_id bigint not null references public.client(id) on delete restrict, programme_id bigint references public.programme(id) on delete set null,
  opportunity_status_id bigint references public.opportunity_status(id) on delete set null, speed_to_market_id bigint references public.speed_to_market(id) on delete set null, sector_id bigint references public.sector(id) on delete set null,
  account_manager_id bigint references public.staff(id) on delete set null, salesman_id bigint references public.staff(id) on delete set null,
  project_title varchar(500) not null, project_description text, opportunity_type varchar(100),
  forecast_value numeric(18,2), probability_percentage numeric(5,2), weighted_value numeric(18,2), secured_value numeric(18,2), currency varchar(3) not null default 'MYR',
  expected_close_date date, actual_close_date date, po_date date, po_value numeric(18,2),
  is_government boolean not null default false, is_private boolean not null default false, is_interco boolean not null default false,
  remarks text, sector_remarks varchar(255), source_file varchar(255), source_row_number integer, import_batch_id bigint,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  constraint chk_opportunity_forecast check(forecast_value is null or forecast_value>=0), constraint chk_opportunity_probability check(probability_percentage is null or probability_percentage between 0 and 100), constraint chk_opportunity_weighted check(weighted_value is null or weighted_value>=0), constraint chk_opportunity_secured check(secured_value is null or secured_value>=0)
);
create index idx_opportunity_client on public.opportunity(client_id); create index idx_opportunity_programme on public.opportunity(programme_id); create index idx_opportunity_status on public.opportunity(opportunity_status_id); create index idx_opportunity_speed on public.opportunity(speed_to_market_id); create index idx_opportunity_sector on public.opportunity(sector_id); create index idx_opportunity_account_manager on public.opportunity(account_manager_id); create index idx_opportunity_salesman on public.opportunity(salesman_id); create index idx_opportunity_close_date on public.opportunity(expected_close_date); create index idx_opportunity_code on public.opportunity(opportunity_code); create index idx_opportunity_import_batch on public.opportunity(import_batch_id); create index idx_opportunity_match on public.opportunity(client_id,project_title,forecast_value);

create table if not exists public.action_item (
  id bigint generated always as identity primary key,
  action_item_code varchar(50), client_id bigint references public.client(id) on delete set null, programme_id bigint references public.programme(id) on delete set null, opportunity_id bigint references public.opportunity(id) on delete set null, invoice_id bigint references public.invoice(id) on delete set null,
  assigned_to_id bigint references public.staff(id) on delete set null, action_item_status_id bigint references public.action_item_status(id) on delete set null, service_type_id bigint references public.service_type(id) on delete set null,
  service varchar(255), action_description text not null, person_in_charge varchar(100), person_email varchar(255), due_date date, completed_date date,
  potential_revenue numeric(18,2), currency varchar(3) not null default 'MYR', aging_days integer, priority varchar(20) not null default 'MEDIUM', notes text,
  source_file varchar(255), source_row_number integer, import_batch_id bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  constraint chk_action_revenue check(potential_revenue is null or potential_revenue>=0), constraint chk_action_aging check(aging_days is null or aging_days>=0), constraint chk_action_priority check(priority in ('LOW','MEDIUM','HIGH','CRITICAL'))
);
create index idx_action_client on public.action_item(client_id); create index idx_action_programme on public.action_item(programme_id); create index idx_action_opportunity on public.action_item(opportunity_id); create index idx_action_invoice on public.action_item(invoice_id); create index idx_action_assigned on public.action_item(assigned_to_id); create index idx_action_status on public.action_item(action_item_status_id); create index idx_action_due_date on public.action_item(due_date); create index idx_action_code on public.action_item(action_item_code); create index idx_action_import_batch on public.action_item(import_batch_id);

create table if not exists public.training_stat (
  id bigint generated always as identity primary key,
  programme_id bigint not null references public.programme(id) on delete restrict, training_type_id bigint references public.training_type(id) on delete set null,
  training_date date, training_name varchar(500), company_name varchar(255), training_category varchar(100), duration_days numeric(5,2), domain_code varchar(50), domain_name varchar(100),
  workshop_count integer not null default 0, training_count integer not null default 0, total_count integer not null default 0, bumiputera_count integer not null default 0, non_bumiputera_count integer not null default 0,
  total_charges_excl_tax numeric(18,2), sst_amount numeric(18,2), final_charges_incl_tax numeric(18,2), currency varchar(3) not null default 'MYR',
  source_file varchar(255), source_row_number integer, import_batch_id bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  constraint chk_training_counts check(workshop_count>=0 and training_count>=0 and total_count>=0 and bumiputera_count>=0 and non_bumiputera_count>=0), constraint chk_training_charges check(total_charges_excl_tax is null or total_charges_excl_tax>=0)
);
create index idx_training_stat_programme on public.training_stat(programme_id); create index idx_training_stat_type on public.training_stat(training_type_id); create index idx_training_stat_date on public.training_stat(training_date); create index idx_training_stat_domain on public.training_stat(domain_code); create index idx_training_stat_company on public.training_stat(company_name); create index idx_training_stat_import_batch on public.training_stat(import_batch_id); create index idx_training_stat_match on public.training_stat(programme_id,training_date,domain_code);

create table if not exists public.participant (
  id bigint generated always as identity primary key,
  programme_id bigint not null references public.programme(id) on delete restrict, training_stat_id bigint references public.training_stat(id) on delete set null,
  full_name varchar(255) not null, identification_no varchar(50), cert_no varchar(100), email varchar(255), phone varchar(50), designation varchar(100), department varchar(100), organization varchar(255),
  is_bumiputera boolean, gender varchar(10), attendance_status varchar(50) not null default 'ATTENDED', cert_issued boolean not null default false, cert_issue_date date,
  source_file varchar(255), source_row_number integer, import_batch_id bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null
);
create index idx_participant_programme on public.participant(programme_id); create index idx_participant_training_stat on public.participant(training_stat_id); create index idx_participant_name on public.participant(full_name); create index idx_participant_cert on public.participant(cert_no); create index idx_participant_bumi on public.participant(is_bumiputera); create index idx_participant_import_batch on public.participant(import_batch_id);
