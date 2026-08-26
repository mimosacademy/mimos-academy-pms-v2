# MIMOS Academy PMS V2 — Production Release

## Authoritative Production Architecture

- React + Vite frontend
- Supabase Auth + PostgreSQL + Storage + Realtime
- Vercel for frontend hosting
- GitHub for source control

Production data access is enforced by PostgreSQL Row Level Security (RLS). React route guards and UI role checks are convenience controls only and are not security boundaries.

## Legacy Components

`apps/pocketbase/` and the related PocketBase migration/backup utilities are retained **only for legacy V1/V2 data migration and historical reference**. PocketBase is not the production backend and must not be started, deployed, or referenced by the Vercel application.

## Security Requirements

1. `apps/pocketbase/pb_data/` is intentionally excluded and must never contain committed production data.
2. Supabase service-role/database credentials must never be placed in browser/Vite environment variables.
3. Every application user must have a matching active `public.staff` record and a valid `staff_role`.
4. Authorization is enforced by PostgreSQL RLS and server-side database constraints/triggers.
5. Financial records are restricted by database policy; client-side hiding is not sufficient.
6. Staging promotion functions are service-role-only.
7. Audit evidence is append-only to application roles.
8. Programme documents use `programmes/{programme_id}/...` storage paths and programme authorization.

## Frontend Environment

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Database Migrations

Apply `supabase/migrations/*.sql` in order. The current security hardening is:

```text
015_migration_function_security.sql
016_security_integrity_hardening.sql
```

Never edit an already-applied migration; create a new forward migration for subsequent changes.

## Quality Gate

The release gate must cover:

- frontend lint/build;
- Supabase migration validation in a disposable environment;
- RLS role-matrix tests;
- financial invariant tests;
- secret scanning;
- production smoke tests.

See `docs/DEPLOYMENT.md` and `docs/PRODUCTION_READINESS.md` for the operational procedure.
