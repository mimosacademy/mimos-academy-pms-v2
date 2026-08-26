-- 026_raw_data_intake_pipeline.sql
-- Raw-data ingestion control plane. Raw uploads are quarantined, fingerprinted,
-- matched against existing business records, and only approved inserts/updates
-- may reach canonical tables.

create schema if not exists intake;

create table if not exists intake.batch (
  id bigint generated always as identity primary key,
  uploaded_by uuid not null,
  file_name text not null,
  file_hash text not null,
  source_type text not null default 'FILE',
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PARSING','ANALYZED','REVIEW_REQUIRED','APPROVED','REJECTED','COMPLETED','FAILED')),
  row_count integer not null default 0,
  new_count integer not null default 0,
  update_count integer not null default 0,
  duplicate_count integer not null default 0,
  rejected_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists ux_intake_batch_file_hash on intake.batch(file_hash);

create table if not exists intake.record (
  id bigint generated always as identity primary key,
  batch_id bigint not null references intake.batch(id) on delete cascade,
  row_number integer not null,
  source_record_id text,
  target_table text,
  target_id bigint,
  operation text not null default 'REVIEW' check (operation in ('NEW','UPDATE','UNCHANGED','DUPLICATE','REVIEW','REJECT')),
  match_confidence numeric(5,4),
  match_reason text,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  payload_hash text,
  validation_errors jsonb not null default '[]'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(batch_id, row_number)
);

create index if not exists ix_intake_record_batch on intake.record(batch_id);
create index if not exists ix_intake_record_target on intake.record(target_table, target_id);
create index if not exists ix_intake_record_payload_hash on intake.record(payload_hash);

create table if not exists intake.review (
  id bigint generated always as identity primary key,
  record_id bigint not null references intake.record(id) on delete cascade,
  reviewer uuid,
  decision text not null check (decision in ('APPROVE_NEW','APPROVE_UPDATE','REJECT','MERGE','NEEDS_CLARIFICATION')),
  notes text,
  created_at timestamptz not null default now()
);

alter table intake.batch enable row level security;
alter table intake.record enable row level security;
alter table intake.review enable row level security;

revoke all on intake.batch, intake.record, intake.review from anon;
revoke all on intake.batch, intake.record, intake.review from authenticated;

-- Intake writes are performed by controlled server-side/Edge Function code.
-- Admin users receive read-only visibility through the application API/function.

comment on schema intake is 'Quarantined raw-data ingestion and deduplication control plane; canonical PMS tables are not written directly from uploaded files.';
comment on table intake.batch is 'One uploaded raw-data file and its processing statistics.';
comment on table intake.record is 'Normalized row-level candidate with deterministic/fuzzy matching decision before canonical DB mutation.';
comment on table intake.review is 'Human approval trail for ambiguous data changes.';
