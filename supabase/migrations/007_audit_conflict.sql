-- 007_audit_conflict.sql

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name varchar(100) not null, record_id bigint not null, field_name varchar(100) not null,
  old_value text, new_value text, change_type varchar(20) not null, action varchar(50) not null,
  ip_address inet, user_agent varchar(500), performed_by_id uuid references auth.users(id) on delete set null, performed_at timestamptz not null default now()
);
create index idx_audit_target on public.audit_log(table_name,record_id); create index idx_audit_field on public.audit_log(field_name); create index idx_audit_performed_by on public.audit_log(performed_by_id); create index idx_audit_performed_at on public.audit_log(performed_at); create index idx_audit_action on public.audit_log(action);

create table if not exists public.data_conflict (
  id bigint generated always as identity primary key,
  import_batch_id bigint references public.import_batch(id) on delete set null, source_file varchar(255), source_row_number integer,
  table_name varchar(100) not null, target_record_id bigint, conflict_type varchar(50) not null, field_name varchar(100), source_value text, existing_value text, conflict_description text,
  resolution_status varchar(50) not null default 'OPEN', resolution_action varchar(50), resolved_value text, resolved_by_id uuid references auth.users(id) on delete set null, resolved_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_conflict_batch on public.data_conflict(import_batch_id); create index idx_conflict_table on public.data_conflict(table_name); create index idx_conflict_status on public.data_conflict(resolution_status); create index idx_conflict_type on public.data_conflict(conflict_type); create index idx_conflict_target on public.data_conflict(target_record_id);

create table if not exists public.completeness_score (
  id bigint generated always as identity primary key, programme_id bigint not null unique references public.programme(id) on delete cascade,
  quotation_score integer not null default 0 check(quotation_score between 0 and 100), po_score integer not null default 0 check(po_score between 0 and 100), invoice_score integer not null default 0 check(invoice_score between 0 and 100), payment_score integer not null default 0 check(payment_score between 0 and 100), delivery_score integer not null default 0 check(delivery_score between 0 and 100), participant_score integer not null default 0 check(participant_score between 0 and 100), charges_score integer not null default 0 check(charges_score between 0 and 100), pic_score integer not null default 0 check(pic_score between 0 and 100),
  overall_score integer not null default 0 check(overall_score between 0 and 100), overall_status varchar(20) not null default 'INCOMPLETE', missing_components jsonb not null default '[]'::jsonb, na_components jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(), evaluated_by_id uuid references auth.users(id) on delete set null
);
create index idx_completeness_overall on public.completeness_score(overall_score); create index idx_completeness_status on public.completeness_score(overall_status);

create table if not exists public.staff_alias (
  id bigint generated always as identity primary key, staff_id bigint not null references public.staff(id) on delete cascade, alias_name varchar(100) not null, source_file varchar(255), is_active boolean not null default true, created_at timestamptz not null default now(), unique(staff_id,alias_name)
);
create index idx_staff_alias_name on public.staff_alias(alias_name);

create table if not exists public.client_alias (
  id bigint generated always as identity primary key, client_id bigint not null references public.client(id) on delete cascade, alias_name varchar(255) not null, source_file varchar(255), is_active boolean not null default true, created_at timestamptz not null default now(), unique(client_id,alias_name)
);
create index idx_client_alias_name on public.client_alias(alias_name);
