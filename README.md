# MIMOS Academy PMS V2 — Production Release

## Authoritative Production Architecture

- React + Vite frontend (`apps/web`)
- Supabase Auth + PostgreSQL + Storage + Realtime
- Vercel for frontend hosting
- GitHub for source control

Production data access is enforced by PostgreSQL Row Level Security (RLS). React route
guards and UI role checks are convenience controls only and are not security boundaries.

## Legacy Components (RETIRED)

`apps/pocketbase/` and the related migration/backup utilities are retained **only for legacy
V1/V2 data migration and historical reference**. PocketBase is not the production backend.

- The PocketBase runtime binary is **not** tracked and must never be committed.
- Legacy VPS/systemd/nginx/backup deployment files live under `legacy/pocketbase-deployment/`.

## Security Requirements

1. `apps/pocketbase/pb_data/` and the PocketBase binary are git-ignored and must never be
   committed.
2. Supabase service-role/database credentials must never be placed in browser/Vite
   environment variables. See `docs/ENVIRONMENT.md`.
3. Every application user must have a matching active `public.staff` record and a valid
   `staff_role`.
4. Authorization is enforced by PostgreSQL RLS and server-side database
   constraints/triggers.
5. Financial records are restricted by database policy; client-side hiding is not sufficient.
6. Staging promotion functions are service-role-only.
7. Audit evidence is append-only to application roles.
8. Programme documents use `programmes/{programme_id}/...` storage paths and programme
   authorization.

## Frontend Environment

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. See `docs/ENVIRONMENT.md`.

## Local development

```bash
npm install            # install all workspaces (root package-lock.json)
npm run dev            # Vite dev server -> http://localhost:3000
npm run verify         # lint + test + build (the application quality gate)
npm test               # Vitest unit tests (role matrix, exact-decimal math)
```

For Supabase-backed functionality locally, first start the local stack:

```bash
npm run supabase:start   # needs the Supabase CLI + Docker
npm run db:regression    # reset local DB, apply migrations, run regression checks
```

See `apps/web/.env.example` for the browser variables required by the app.

## Database Migrations

Apply `supabase/migrations/*.sql` in filename order (001 → 048). Security hardening is
distributed across the chain; the highest-impact remediation migrations include:

```text
015_migration_function_security.sql
016_security_integrity_hardening.sql
017_authorization_boundary_hardening.sql
018/019_application_transaction_hardening.sql
020_private_authorization_execution.sql
044_private_authorization_helpers.sql
```

Never edit an already-applied migration; create a new forward migration for subsequent
changes. Use `npm run supabase:reset` (local) and `supabase db push` (remote) to apply.

## Quality Gate

The release gate covers:

- frontend lint/build (`npm run verify`);
- automated unit tests (`npm test`);
- Supabase migration validation in a disposable environment (`supabase-migrations` CI job +
  `scripts/db-regression.sh`);
- RLS role-matrix & financial-invariant checks (`supabase/tests/*.sql`);
- static architecture/security markers and secret scanning (`.github/workflows/quality.yml`).

See `docs/DEPLOYMENT.md`, `docs/PRODUCTION_READINESS.md`, and `docs/ENVIRONMENT.md` for the
operational procedure, and `docs/DEVELOPMENT_PLAN.md` for the roadmap.
