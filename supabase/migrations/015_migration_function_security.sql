-- 015_migration_function_security.sql
-- Canonical promotion is a migration operation, not a browser operation.
-- Keep it off the authenticated role to prevent client-side promotion of staging rows.

REVOKE EXECUTE ON FUNCTION public.promote_stg_invoice(bigint) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.promote_stg_quotation(bigint) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.promote_stg_funnel(bigint) FROM authenticated, anon, public;

GRANT EXECUTE ON FUNCTION public.promote_stg_invoice(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_stg_quotation(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_stg_funnel(bigint) TO service_role;
