-- Read-only verification for migration 017.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
AND p.proname IN (
  'calc_invoice_days_outstanding',
  'recalc_invoice_collection',
  'trg_invoice_financials',
  'trg_payment_financials',
  'trg_recalc_invoice_collection',
  'validate_allocation_invariants',
  'validate_payment_invariants'
)
ORDER BY p.proname;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('promote_stg_invoice','sp_import_stg_invoice','sp_get_overdue_invoices')
ORDER BY p.proname;
