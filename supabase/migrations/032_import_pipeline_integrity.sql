-- 032_import_pipeline_integrity.sql
-- Enforce intake uniqueness and prevent change-set references from becoming dangling.

create unique index if not exists ux_intake_record_source_identity
on intake.record(batch_id, source_record_id)
where source_record_id is not null and nullif(trim(source_record_id),'') is not null;

create unique index if not exists ux_intake_record_payload_unprocessed
on intake.record(batch_id, payload_hash)
where payload_hash is not null and operation in ('REVIEW','NEW','UPDATE');

alter table intake.change_ledger
  drop constraint if exists change_ledger_operation_check;
alter table intake.change_ledger
  add constraint change_ledger_operation_check
  check (operation in ('NEW','UPDATE','UNCHANGED','DUPLICATE','CONFLICT','REVIEW','REJECT'));

comment on index ux_intake_record_source_identity is 'Prevents the same source record identity being ingested twice within a batch.';
comment on index ux_intake_record_payload_unprocessed is 'Prevents identical candidate payloads being processed repeatedly within a batch.';
