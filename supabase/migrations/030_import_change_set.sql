-- 030_import_change_set.sql
-- Safe promotion primitives for analysed raw-data rows.

create schema if not exists intake;

create table if not exists intake.change_set (
  id bigint generated always as identity primary key,
  batch_id bigint not null references intake.batch(id) on delete restrict,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','VALIDATED','APPROVED','APPLIED','REJECTED')),
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz
);

create table if not exists intake.change_set_item (
  id bigint generated always as identity primary key,
  change_set_id bigint not null references intake.change_set(id) on delete restrict,
  record_id bigint not null references intake.record(id) on delete restrict,
  target_table text not null,
  target_id bigint,
  operation text not null check (operation in ('NEW','UPDATE')),
  proposed_payload jsonb not null,
  expected_existing_hash text,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','VALIDATED','APPROVED','APPLIED','REJECTED','CONFLICT')),
  unique(change_set_id,record_id)
);

alter table intake.change_set enable row level security;
alter table intake.change_set_item enable row level security;
revoke all on intake.change_set, intake.change_set_item from anon, authenticated;

create or replace function intake.guard_change_set_transition()
returns trigger language plpgsql security definer set search_path=intake,public as $$
begin
  if old.status='APPLIED' and new.status <> 'APPLIED' then raise exception 'Applied change sets are immutable'; end if;
  if old.status='REJECTED' and new.status <> 'REJECTED' then raise exception 'Rejected change sets are immutable'; end if;
  if new.status='APPLIED' and old.status <> 'APPROVED' then raise exception 'Only approved change sets may be applied'; end if;
  return new;
end;
$$;
revoke all on function intake.guard_change_set_transition() from public;

drop trigger if exists trg_change_set_transition on intake.change_set;
create trigger trg_change_set_transition before update on intake.change_set for each row execute function intake.guard_change_set_transition();

comment on table intake.change_set is 'Explicit proposed/validated/approved/applied boundary between data analysis and canonical database mutation.';
comment on table intake.change_set_item is 'Idempotent candidate insert/update with expected-existing hash for optimistic conflict detection.';
