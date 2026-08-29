# DELEGATION PROMPT — GPT (Round 2) — DEPLOY Supabase + Vercel

You are acting for the owner of **MIMOS Academy PMS V2**. Round 1 (CI workflow push) is DONE
and verified. This round deploys the application for real. **First run the ACCESS CHECK**
at the bottom. If you cannot access the required CLIs/network/credentials, DO NOT attempt
anything — just fill the report and return. Security first.

## Repo context (verified — trust these)

- Repo: `mimosacademy/mimos-academy-pms-v2`
- Branch: **`arena/01a04d52-mimos-academy-pms-v2`** (head contains all work + CI workflow).
- Frontend: `apps/web` — React/Vite. Deploy root = `apps/web`.
- Backend: Supabase (Auth/PostgreSQL/Storage/Realtime). Migrations are in `supabase/migrations/`
  (45 files, 001–048). Edge Functions in `supabase/functions/` (7 functions).
- Staff provisioning script: `tools/supabase/provision-staff.mjs`.
- Docs that must be followed: `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`,
  `docs/PRODUCTION_READINESS.md`.

## Non-negotiable security rules

- **NEVER print, log, or paste any secret** (service-role key, DB password, access token,
  Vercel token) into the report, commit messages, or files.
- Secrets must come from **environment variables already set in your environment**, e.g.
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`,
  `VERCEL_TOKEN`. Verify presence only (e.g. `[ -n "$VAR" ] && echo set`) — never echo values.
- The browser/Vercel environment must contain **only** `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable (anon) key is fine; the service-role key
  must NEVER be a Vite/Vercel browser env var.
- `apps/web/.env` is git-ignored. Do not commit it.

## Deliverables this round

### A. Supabase project (create or use existing)
1. Use project ref `sduudaavhlpgrxpqwahc` if it exists and is accessible; otherwise create a
   new dedicated project **not named/associated with masb-governance**. Nearest region.
2. Ensure email auth is enabled with email confirmation; the app relies on `auth.users` +
   `public.staff.auth_user_id`.
3. Config the Auth URL/redirects to match the final Vercel domain (add
   `https://<your-vercel-domain>/**` to redirect URLs). Set `site_url`.

### B. Apply all migrations in order
```
supabase/migrations/001_extensions.sql ... 048_masb_team_full_operational_access.sql
```
Run in filename order (e.g. `supabase migration up` after `supabase link`, or `supabase db push`).
- The chain is forward-only; do NOT edit existing files.
- After applying, run the read-only regression/security checks:
  `supabase/tests/*.sql` (11 files) via `psql` against a test connection, or run
  `scripts/db-regression.sh` locally first.

### C. Storage bucket
- Create private bucket `pms-documents` policies per migration `012_storage.sql` /
  `016_security_integrity_hardening.sql` (programme-scoped paths).

### D. Edge Functions deploy
- Deploy each function under `supabase/functions/` that is used by the app:
  `admin-invite-user`, `admin-list-users`, `admin-user-action`, `data-intake-analyze`,
  `data-intake-compare`, `data-intake-ingest`, `data-intake-promote`.
- They must forward the caller's JWT; do NOT default to service-role.

### E. Provision staff + roles
- `public.staff` must have rows; run the provisioning with a server-side service-role key:
  ```
  SUPABASE_URL=<project-url> SUPABASE_SERVICE_ROLE_KEY=<from env> \
  SUPABASE_INVITE_REDIRECT_URL=https://<your-vercel-domain> \
  node tools/supabase/provision-staff.mjs
  ```
- Verify each user has an active `public.staff` row + valid `staff_role`.

### F. Vercel deploy (frontend)
- Project root: `apps/web`. Framework preset Vite.
- Install: `npm ci`. Build: `npm run build`. Output dir default (`dist`).
- Environment variables (browser): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- After deploy, set the custom domain (hosted at Hostinger) per Vercel's DNS records.
- Confirm the deployment READY and the domain resolves.

### G. Smoke test
- Login works (for a provisioned user).
- Dashboard renders without console errors.
- One representative programme + invoice + payment flow works; overpayment is rejected.
- Viewer cannot read invoice/payment; PIC cannot read another programme.

## ACCESS CHECK — run FIRST, before doing anything

```bash
echo "--- tool availability ---"
for c in node npm supabase vercel psql gh; do
  if command -v "$c" >/dev/null 2>&1; then echo "$c: $(command -v $c)"; else echo "$c: MISSING"; fi
done
echo "--- network ---"
(curl -sS -m 8 -o /dev/null -w "github=%{http_code}\n" https://github.com || echo "github: no network")
(curl -sS -m 8 -o /dev/null -w "supabase=%{http_code}\n" https://supabase.com || echo "supabase: no network")
(curl -sS -m 8 -o /dev/null -w "vercel=%{http_code}\n" https://vercel.com || echo "vercel: no network")
echo "--- credentials present? (presence only, no values) ---"
for v in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY VERCEL_TOKEN; do
  if [ -n "${!v:-}" ]; then echo "$v: set"; else echo "$v: MISSING"; fi
done
```

- If `supabase`/`vercel` CLIs are MISSING or network fails or **any** required credential is
  MISSING → **STOP**, fill the report, return. Do not guess.
- If all present → proceed A→G and report each.

## REPORT BACK (fill + return verbatim)

```
ROUND 2 — DEPLOY SUPABASE + VERCEL
access_ok: yes/no
supabase_cli: path_or_MISSING
vercel_cli: path_or_MISSING
psql: path_or_MISSING
network: <github/supabase/vercel codes>
creds: <set/MISSING for each var, names only>
supabase_project_ref: <ref used>
migrations_applied: <count / 45, and last file applied>
storage_bucket_created: yes/no/n-a
edge_functions_deployed: <list]
staff_provisioned: <count>
vercel_deploy_status: <READY/other>
vercel_domain: <url or n/a>
smoke_passed: <which items passed / failed>
secrets_exposed: <no — confirm>
blocked_by: <what, if anything>
stderr_if_failed: <exact or n/a>
```

---

## If you CANNOT run the CLIs (common for some GPT shells)
Do not attempt. Instead set `access_ok: no`, `blocked_by: <reason>`, and I (the sysop) will
hand the owner a manual runbook. Your job this round then is only to report access.
