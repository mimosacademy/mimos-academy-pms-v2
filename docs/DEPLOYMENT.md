# MIMOS Academy PMS V2 — Supabase + Vercel Deployment Runbook

## 1. Authoritative architecture

Production architecture is:

`React/Vite → Vercel → Supabase Auth / PostgreSQL / Storage / Realtime`

PocketBase is **legacy only** and must not be started, deployed, referenced by Vercel, or
used as a production backend. Its runtime binary is git-ignored and not tracked, and the
retired VPS/systemd/nginx/backup deployment files live under `legacy/pocketbase-deployment/`
(see `legacy/README.md`).

## 2. Frontend

Deploy `apps/web` as the Vercel project root.

Vercel project settings:

- Root Directory: `apps/web`
- Framework Preset: `Vite`
- Install Command: `npm ci`
- Build Command: `npm run build`

`apps/web/vercel.json` supplies the SPA rewrite plus security headers (CSP, HSTS,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) and
immutable caching for `/assets/*`.

Required browser-side environment variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in browser/Vite environment variables. See
`docs/ENVIRONMENT.md`.

## 3. Database migrations

Apply `supabase/migrations/*.sql` in filename order (001 → 048).

Locally, reset + apply the whole chain to a disposable Supabase stack:

```bash
npm run supabase:start   # Supabase CLI + Docker
npm run db:regression    # supabase db reset + apply migrations + run regression checks
```

Security remediation is spread across the chain, notably:

```text
015_migration_function_security.sql        # staging promotion service-role only
016_security_integrity_hardening.sql       # broad RLS / financial / storage hardening
017_authorization_boundary_hardening.sql   # closes self-service privilege escalation
018/019_application_transaction_hardening.sql
020_private_authorization_execution.sql    # private authorization execution boundary
044_private_authorization_helpers.sql      # private RLS helper definitions
```

Migration `015` keeps staging promotion service-role-only. `016` establishes the broad
RLS/financial/storage hardening. `017` is a **forward-only follow-up** that closes
self-service privilege-escalation paths and removes legacy browser RPC exposure.

Never edit an already-applied migration. Add a new forward migration.

Before applying a new security migration to production:

1. Export/backup the current database.
2. Apply the migration in a disposable/staging project first (`npm run db:regression` or
   the `supabase-migrations` CI job).
3. Verify the migration completes without SQL errors.
4. Test each role in the role matrix.
5. Test invoice/payment creation, overpayment rejection and allocation limits.
6. Test Storage access with two different programme IDs.
7. Run Supabase security advisors and resolve any new high/critical findings.
8. Only then apply to production (`supabase db push`).

## 4. Authentication and roles

Every application user must have a matching active row in `public.staff.auth_user_id` and a valid active `staff_role`.

`public.staff.role_id` is the authoritative PMS authorization source. `public.profiles.role` must not be used to grant PMS privileges.

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

Self-service profile/staff updates must not be able to modify `role_id`, `is_active`, `auth_user_id`, `staff_id`, or profile `role`. These security-sensitive fields are administrator-controlled.

## 5. Security verification

From Supabase SQL Editor and controlled test accounts, verify:

- Viewer cannot read `invoice`, `payment`, or `invoice_payment_allocation`.
- PIC/Trainer can only access programme-scoped records permitted by their programme assignment.
- Finance can access financial records.
- Authenticated users cannot execute staging promotion functions; those functions are service-role-only when present.
- Legacy browser RPC helpers are not executable by `anon`.
- Private authorization helpers remain available to RLS evaluation but are not exposed to `anon`.
- Application roles cannot directly modify/delete audit records.
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

CI (`.github/workflows/quality.yml`) tests the Supabase architecture, not PocketBase. It
runs on push to `main`/`release/**` and on pull requests to `main`:

- `web` — `npm ci` (root workspace lockfile), `npm run lint`, `npm run test`, `npm run build`.
- `supabase-static-security` — fast marker/RLS/secrets checks over the migration source.
- `supabase-migrations` — boots a disposable local Supabase stack (Supabase CLI), applies
  the full migration chain, and runs the regression/security checks under `supabase/tests/`
  via `scripts/db-regression.sh`. Requires Docker (available on GitHub-hosted runners).
- `deployment-config-check` — verifies `vercel.json`, `supabase/config.toml`,
  `apps/web/.env.example` exist and that no PocketBase deployment language remains.

`npm run verify` runs the application gate locally (lint + test + build).

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
- Non-admin self-update of staff security fields is rejected.
- Non-admin self-update of profile security fields is rejected.
- Audit event is created and cannot be modified by the application role.

## 11. Rollback

Do not blindly reverse a security migration. If a release causes a legitimate workflow failure:

1. Disable affected user workflow if necessary.
2. Preserve the failed state and error evidence.
3. Identify the exact policy/constraint causing the failure.
4. Apply a targeted forward migration after testing.
5. Re-run the full security smoke test.

A rollback that restores `USING (true)` or unrestricted privileged functions is not an acceptable security rollback.
