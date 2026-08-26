# MIMOS Academy PMS V2 — Supabase + Vercel Deployment Runbook

## 1. Authoritative architecture

Production architecture is:

`React/Vite → Vercel → Supabase Auth / PostgreSQL / Storage / Realtime`

PocketBase is **legacy only** and must not be started, deployed, referenced by Vercel, or used as a production backend.

## 2. Frontend

Deploy `apps/web` as the Vercel project root.

Required browser-side environment variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in browser/Vite environment variables.

## 3. Database migrations

Apply Supabase migrations in filename order. The security remediation migration is:

```text
supabase/migrations/016_security_integrity_hardening.sql
```

Migration `015_migration_function_security.sql` remains authoritative for staging promotion and keeps `promote_stg_*` functions service-role-only.

Before applying `016_security_integrity_hardening.sql` to production:

1. Export/backup the current database.
2. Apply the migration in a disposable/staging project first.
3. Verify the migration completes without SQL errors.
4. Test each role in the role matrix.
5. Test invoice/payment creation, overpayment rejection and allocation limits.
6. Test Storage access with two different programme IDs.
7. Run Supabase security advisors and resolve any new high/critical findings.
8. Only then apply to production.

Never edit an already-applied migration. Add a new forward migration.

## 4. Authentication and roles

Every application user must have a matching active row in `public.staff.auth_user_id` and a valid `staff_role`.

Minimum production roles:

- SUPER_ADMIN / ADMIN
- MANAGER
- FINANCE
- SALES
- MASB_TEAM
- PIC
- TRAINER
- VIEWER

Do not rely on hidden React menus for authorization. PostgreSQL RLS is the security boundary.

## 5. Security verification

From Supabase SQL Editor and controlled test accounts, verify:

- Viewer cannot read `invoice`, `payment`, or `invoice_payment_allocation`.
- PIC/Trainer can only access programme-scoped records permitted by their programme assignment.
- Finance can access financial records.
- Authenticated users cannot execute staging promotion functions; those functions are service-role-only.
- Audit records cannot be updated/deleted by application roles.
- Views used by dashboards enforce underlying RLS.
- Storage objects under `programmes/{programme_id}/...` cannot be read across programmes.
- Service-role credentials are absent from frontend source and Vercel browser environment variables.

## 6. Storage

Use this layout:

```text
programmes/{programme_id}/quotations/...
programmes/{programme_id}/purchase-orders/...
programmes/{programme_id}/invoices/...
programmes/{programme_id}/supporting-documents/...
```

The programme ID in the object path is part of the authorization decision.

## 7. CI/CD

CI must test the Supabase architecture, not PocketBase. Minimum release gate:

- `npm ci` after a committed, verified `package-lock.json` is available.
- Build and lint the Vite application.
- Apply/reset Supabase migrations in a disposable test environment.
- Run RLS/security tests.
- Run financial-invariant tests.
- Run secret scanning.

Until the Supabase test environment is configured, use the manual security checklist in `docs/PRODUCTION_READINESS.md` and do not treat a green PocketBase workflow as production evidence.

## 8. Incident / credential response

If the repository has ever contained production data or credentials:

1. Keep the repository private immediately.
2. Rotate Supabase service-role/database credentials and any GitHub/Vercel tokens that may have been exposed.
3. Remove real customer/staff data from the current tree and replace it with synthetic fixtures.
4. Treat old Git clones/forks as potentially containing the exposed material.
5. Record and escalate the incident through the organization's DPO/security process.

## 9. Backup and restore

Document the actual Supabase plan's backup capability. Perform a restore drill to a disposable environment and verify:

- database starts;
- authentication works;
- expected tables exist;
- RLS policies exist;
- one representative programme, invoice and payment flow works.

Do not claim backup/DR readiness until a restore has been successfully demonstrated.

## 10. Production smoke test

Run after every security or database release:

- Super Admin login.
- Manager login.
- Finance login.
- Sales login.
- PIC login.
- Trainer login.
- Viewer login.
- Viewer direct API access to invoice/payment must be denied.
- PIC cross-programme access must be denied.
- Finance payment creation succeeds for valid data.
- Overpayment is rejected server-side.
- Duplicate `operation_id` is rejected.
- Allocation above payment/invoice total is rejected.
- Programme document upload/download works only for authorized programme access.
- Audit event is created and cannot be modified by the application role.

## 11. Rollback

Do not blindly reverse a security migration. If a release causes a legitimate workflow failure:

1. Disable affected user workflow if necessary.
2. Preserve the failed state and error evidence.
3. Identify the exact policy/constraint causing the failure.
4. Apply a targeted forward migration after testing.
5. Re-run the full security smoke test.

A rollback that restores `USING (true)` or unrestricted privileged functions is not an acceptable security rollback.
