# MIMOS Academy PMS — PocketBase → Supabase Runbook

## Target architecture

React/Vite → Vercel → Supabase PostgreSQL/Auth/Storage/Realtime. Hostinger is DNS/domain management only after migration.

## SQL migration order

Run these in order:

1. `supabase/migrations/001_extensions.sql`
2. `supabase/migrations/002_lookup_tables.sql`
3. `supabase/migrations/003_master_tables.sql`
4. `supabase/migrations/004_core_financial_tables.sql`
5. `supabase/migrations/005_operations_tables.sql`
6. `supabase/migrations/006_staging_import.sql`
7. `supabase/migrations/007_audit_conflict.sql`
8. `supabase/migrations/008_triggers.sql`
9. `supabase/migrations/009_functions.sql`
10. `supabase/migrations/010_views.sql`
11. `supabase/migrations/011_rls.sql`
12. `supabase/migrations/012_storage.sql`

Use Supabase SQL Editor or the Supabase CLI. Do not paste the whole set into a production database until the project has been created and a backup/rollback plan is in place.

## Supabase project

Create a **new project dedicated to MIMOS Academy PMS**. Do not modify the existing `masb-governance` project.

Recommended settings:
- Project name: `mimos-academy-pms`
- Region: choose the nearest supported region to the MIMOS user base.
- Database password: generate a unique password and store it in a password manager.
- Email Auth: enabled.
- Email confirmations: enabled for normal users; invitation flow is used for staff provisioning.

## Authentication model

`auth.users.id` is the identity key. `public.staff.auth_user_id` links the Supabase user to the business profile.

Business role remains in `public.staff_role` + `public.staff.role_id` so authorization is not based on user-editable metadata.

Roles supplied by the source model:
- SUPER_ADMIN
- MANAGER
- PIC
- SALES
- FINANCE
- TRAINER
- MASB_TEAM
- INTERN

The application defaults unknown/missing role to VIEWER at the UI layer, but a user must have an active `staff` profile to pass staff RLS policies.

## Staff provisioning

After schema installation:

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="SERVER_ONLY_SECRET" \
SUPABASE_INVITE_REDIRECT_URL="https://pms.example.com" \
node tools/supabase/provision-staff.mjs
```

The script sends Auth invitations and stores the returned UUID in `staff.auth_user_id`.

Never put `SUPABASE_SERVICE_ROLE_KEY` in Vite, GitHub, browser code, or Vercel client-side environment variables.

## PocketBase data migration

Obtain a read-only copy of the production PocketBase SQLite database before decommissioning PocketBase:

```text
pb_data/data.db
```

Then run a dry run first:

```bash
SUPABASE_DB_URL="postgresql://..." \
python tools/migration/pocketbase_to_supabase.py pocketbase \
  --db ./pb_data/data.db
```

The migration stages every source row in `stg_raw_record`, maps supported PocketBase collections into the canonical model, and creates `data_conflict` records instead of guessing unresolved relationships.

Commit only after dry-run validation:

```bash
SUPABASE_DB_URL="postgresql://..." \
python tools/migration/pocketbase_to_supabase.py pocketbase \
  --db ./pb_data/data.db --commit
```

## Excel staging

Place source workbooks in a local migration directory, for example:

```text
migration-input/excel/
```

Then:

```bash
SUPABASE_DB_URL="postgresql://..." \
python tools/migration/pocketbase_to_supabase.py excel \
  --folder ./migration-input/excel
```

The loader preserves workbook/sheet/row lineage and raw values in `stg_raw_record`. The canonical staging tables remain available for validated R1/R2/R3 imports.

## Data quality rules

- Monetary fields use PostgreSQL `numeric`, never floating point.
- `N/A` is not silently converted to a meaningful business value.
- `NULL` means unknown/not supplied; explicit `N/A` belongs in an audited state such as `na_components` or a conflict/validation record.
- Composite matching indexes are used for deduplication.
- Foreign-key failures are parked in `data_conflict`.
- Source file, source row, and import batch are retained on canonical records where applicable.

## RLS

All application tables have RLS enabled in `011_rls.sql`.

Browser clients use only the publishable Supabase key. Service-role access is restricted to server/Edge Functions and migration tooling.

## Storage

Bucket: `pms-documents` (private).

Recommended paths:

```text
programmes/{programme_id}/quotations/{file}
programmes/{programme_id}/purchase-orders/{file}
programmes/{programme_id}/invoices/{file}
programmes/{programme_id}/supporting-documents/{file}
imports/{import_batch_id}/original-files/{file}
```

The browser uploads through Storage RLS; it never receives a service-role key.

## Realtime

`008_triggers.sql` adds core tables to the `supabase_realtime` publication where needed. The React context subscribes to Postgres Changes and refreshes derived state after mutations.

## Vercel

Set these client-side variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not set `SUPABASE_SERVICE_ROLE_KEY` as a Vite/browser variable.

## Hostinger DNS

After Vercel assigns the production domain, configure DNS at Hostinger according to the exact records Vercel provides. Do not guess A/CNAME values. Verify the custom domain in Vercel before switching the live DNS.

## PocketBase decommission

Only after:
1. Supabase schema is verified.
2. Staff can sign in.
3. Canonical data counts reconcile.
4. R1/R2/R3 reports reconcile.
5. File downloads/uploads work.
6. Realtime works.
7. Vercel production passes browser smoke tests.
8. A final PocketBase backup is archived.

Then remove the PocketBase VPS service, API DNS record, deployment unit, and repository-only PocketBase runtime files.
