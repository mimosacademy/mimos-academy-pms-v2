# Operator Deployment Runbook (manual) — MIMOS Academy PMS V2

This is the human/operator runbook for deploying to real Supabase + Vercel. It is used
when no autonomous agent has CLI/credentials access. Follow it top-to-bottom.

> Principle: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` only go in Vercel
> browser env. `SUPABASE_SERVICE_ROLE_KEY` / DB password are server-side/CLI only.
> See `docs/ENVIRONMENT.md`.

---

## 1. Supabase project

1. Open [supabase.com](https://supabase.com), use the existing project
   (ref `sduudaavhlpgrxpqwahc`) or create a new dedicated project (`mimos-academy-pms`),
   nearest region.
2. **Auth settings:** enable Email auth + email confirmation. Set **Site URL** to the final
   Vercel domain and add redirect URLs: `https://<your-vercel-domain>/**` and
   `https://localhost:3000/**` for dev.

## 2. Apply migrations

> **IMPORTANT — do NOT use `supabase db push` for this repo.**
> Migration files use 3-digit prefixes (`001_...`–`048_...`); the Supabase CLI records
> versions in timestamp format (e.g. `20260827033124`) and cannot reconcile them. Use the
> **deterministic runner** or **SQL Editor in order**.

### Option A — deterministic runner (recommended)
```bash
SUPABASE_DB_URL="postgresql://..." scripts/apply-migrations.sh
```
- `scripts/apply-migrations.sh` applies all **45** files in filename order with
  `ON_ERROR_STOP=1` (stops on first error).
- To also run the regression checks afterwards:
  `RUN_REGRESSION=1 SUPABASE_DB_URL="postgresql://..." scripts/apply-migrations.sh`.
- `scripts/migration-order.txt` = ordered list of the 45 files.
- `scripts/migration-checksums.txt` = SHA-256 per file (integrity check).

### Option B — SQL Editor (manual)
Run each file in `supabase/migrations/` in filename order (see `scripts/migration-order.txt`)
one at a time in the SQL Editor; **stop on the first error**. Do not edit an already-applied
migration; create a new forward migration for changes.

After migrating, run the read-only checks under `supabase/tests/*.sql` (11 files) and confirm
**45** migrations applied.

## 3. Storage bucket

- Create a **private** bucket `pms-documents`. Programme-scoped policies are provided by
  migrations `012_storage.sql` / `016_security_integrity_hardening.sql`.

## 4. Edge Functions

Deploy each app function (forward the caller JWT; do NOT default to service-role):
```bash
supabase functions deploy admin-invite-user
supabase functions deploy admin-list-users
supabase functions deploy admin-user-action
supabase functions deploy data-intake-analyze
supabase functions deploy data-intake-compare
supabase functions deploy data-intake-ingest
supabase functions deploy data-intake-promote
```

## 5. Provision staff & roles (server-side only)

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<from env / password manager>" \
SUPABASE_INVITE_REDIRECT_URL="https://<your-vercel-domain>" \
node tools/supabase/provision-staff.mjs
```
Confirm each user has an active `public.staff` row + valid `staff_role`.

## 6. Vercel deploy (frontend)

1. Vercel → **New Project** → import `mimosacademy/mimos-academy-pms-v2`.
2. **Root Directory:** `apps/web`, **Framework Preset:** Vite.
3. **Install:** `npm ci`, **Build:** `npm run build`, **Output:** `dist`.
4. **Environment variables** (browser):
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`
5. Deploy → wait for **READY**.
6. **Custom domain:** set DNS records at Hostinger per Vercel's instructions; verify.

## 7. Smoke test (per docs/PRODUCTION_READINESS §13)

- Login (Super Admin, Manager, Finance, Sales, PIC, Trainer, Viewer).
- Viewer direct invoice/payment access = denied.
- PIC cross-programme access = denied.
- Valid payment succeeds; overpayment rejected server-side; duplicate `operation_id` rejected.
- Programme document upload/download works only for authorised programme access.
- Dashboard & critical routes render without errors.

## Final audit

- `npm run verify` passes (lint + test + build).
- No `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/src`, in Vercel browser env, or in the repo.
- Supabase security advisors clean; backup/DR restore drill performed.
