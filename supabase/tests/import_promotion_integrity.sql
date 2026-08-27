-- PMS V2 import-promotion regression checks (read-only/static).
-- Expected after migrations are applied:
-- 1) apply_change_set is service-role only.
-- 2) the promotion Edge Function accepts change_set_id, not arbitrary row payloads.
-- 3) private.apply_import_update remains service-role/server-only.

select
  has_function_privilege('anon','intake.apply_change_set(bigint)','EXECUTE') as anon_execute,
  has_function_privilege('authenticated','intake.apply_change_set(bigint)','EXECUTE') as authenticated_execute,
  has_function_privilege('service_role','intake.apply_change_set(bigint)','EXECUTE') as service_role_execute;

select
  has_function_privilege('anon','private.apply_import_update(text,bigint,text,jsonb)','EXECUTE') as anon_execute,
  has_function_privilege('authenticated','private.apply_import_update(text,bigint,text,jsonb)','EXECUTE') as authenticated_execute,
  has_function_privilege('service_role','private.apply_import_update(text,bigint,text,jsonb)','EXECUTE') as service_role_execute;

select
  target_table,
  source_field,
  target_field,
  required,
  transform
from intake.field_mapping
order by target_table, source_field;

select
  target_table,
  target_id,
  operation,
  status,
  expected_existing_hash is not null as has_expected_hash
from intake.change_set_item
where operation='UPDATE'
order by id desc
limit 100;
