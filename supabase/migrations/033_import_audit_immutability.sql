-- 033_import_audit_immutability.sql
-- Make change ledger append-only and remove over-aggressive payload uniqueness.

drop index if exists intake.ux_intake_record_payload_unprocessed;

create or replace function intake.prevent_change_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = intake, public
as $$
begin
  raise exception 'Change ledger is append-only';
end;
$$;
revoke all on function intake.prevent_change_ledger_mutation() from public, anon, authenticated;

drop trigger if exists trg_change_ledger_no_update on intake.change_ledger;
drop trigger if exists trg_change_ledger_no_delete on intake.change_ledger;
create trigger trg_change_ledger_no_update before update on intake.change_ledger for each row execute function intake.prevent_change_ledger_mutation();
create trigger trg_change_ledger_no_delete before delete on intake.change_ledger for each row execute function intake.prevent_change_ledger_mutation();

comment on table intake.change_ledger is 'Append-only provenance ledger. Identical payloads are not globally treated as duplicates; identity resolution determines duplicate status.';
