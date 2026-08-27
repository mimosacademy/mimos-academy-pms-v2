-- 027_data_change_ledger.sql
-- Immutable ledger for raw-data decisions and canonical mutations.

create schema if not exists intake;

create table if not exists intake.change_ledger (
  id bigint generated always as identity primary key,
  batch_id bigint references intake.batch(id) on delete restrict,
  record_id bigint references intake.record(id) on delete restrict,
  target_table text not null,
  target_id bigint,
  operation text not null check (operation in ('NEW','UPDATE','UNCHANGED','DUPLICATE','CONFLICT','REVIEW','REJECT')),
  before_payload jsonb,
  after_payload jsonb,
  changed_fields jsonb not null default '[]'::jsonb,
  decision_reason text not null,
  confidence numeric(5,4),
  decided_by uuid,
  decided_at timestamptz not null default now()
);

create index if not exists ix_change_ledger_target on intake.change_ledger(target_table,target_id);
create index if not exists ix_change_ledger_batch on intake.change_ledger(batch_id);

alter table intake.change_ledger enable row level security;
revoke all on intake.change_ledger from anon, authenticated;

comment on table intake.change_ledger is 'Immutable audit ledger for raw-data classification and proposed/applied canonical data changes.';
