-- Import pipeline regression checks.
-- Run after migrations 039, 041 and 042.

-- Promotion must remain server-side only.
SELECT
  has_function_privilege('anon', 'intake.apply_change_set(bigint)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'intake.apply_change_set(bigint)', 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', 'intake.apply_change_set(bigint)', 'EXECUTE') AS service_role_execute;

-- Promotion engine must use the canonical hash helper for optimistic concurrency.
SELECT position('current_hash := private.canonical_json_hash(current_row);' IN pg_get_functiondef('intake.apply_change_set(bigint)'::regprocedure)) > 0
  AS uses_canonical_hash;

-- Change-set items deliberately accept only mutation operations; the compare
-- service must keep INCOMPLETE/DUPLICATE/CONFLICT rows out of promotion.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'intake.change_set_item'::regclass
  AND conname IS NOT NULL
ORDER BY conname;

-- Canonical hashing must exclude volatile timestamps.
SELECT private.canonical_json_hash('{"id":1,"name":"Example","created_at":"2000-01-01T00:00:00Z","updated_at":"2020-01-01T00:00:00Z"}'::jsonb)
       = private.canonical_json_hash('{"id":1,"name":"Example","created_at":"2025-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}'::jsonb)
  AS volatile_timestamps_ignored;
