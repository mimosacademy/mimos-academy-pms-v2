-- PMS V2: privileged financial helper execution hardening
-- Prevent PUBLIC/anon/authenticated from invoking internal financial and trigger helpers.
-- Trigger functions remain callable by PostgreSQL trigger execution; application roles do not need EXECUTE.

BEGIN;

REVOKE EXECUTE ON FUNCTION private.calc_invoice_days_outstanding() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.recalc_invoice_collection(bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.trg_invoice_financials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.trg_payment_financials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.trg_recalc_invoice_collection() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.validate_allocation_invariants() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.validate_payment_invariants() FROM PUBLIC, anon, authenticated;

-- Explicitly retain service_role execution for controlled server-side operations.
GRANT EXECUTE ON FUNCTION private.calc_invoice_days_outstanding() TO service_role;
GRANT EXECUTE ON FUNCTION private.recalc_invoice_collection(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION private.trg_invoice_financials() TO service_role;
GRANT EXECUTE ON FUNCTION private.trg_payment_financials() TO service_role;
GRANT EXECUTE ON FUNCTION private.trg_recalc_invoice_collection() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_allocation_invariants() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_payment_invariants() TO service_role;

COMMIT;
