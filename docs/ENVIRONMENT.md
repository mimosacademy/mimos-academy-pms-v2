# Environment variables & secrets

This project runs on **Vercel** (frontend) and **Supabase** (Auth / PostgreSQL / Storage /
Realtime). The cardinal rule: **never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.**

## 1. Browser-side variables (Vite / Vercel)

These are the **only** variables that belong in `Vercel → Settings → Environment Variables`
or in `apps/web/.env`.

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | Supabase project URL | `https://abcdefg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase **publishable** (anon) key | `eyJhbGciOi...` |

They are read by `apps/web/src/lib/supabaseClient.js` and `apps/web/src/lib/dataIntakeApi.js`.
Duplicate into `apps/web/.env` for local dev (see `apps/web/.env.example`).

> `VITE_*` vars are compiled into the browser bundle at build time. Anything in a `VITE_*`
> variable is considered public. **Never** name a secret `VITE_SERVICE_ROLE_KEY`.

## 2. Server-only variables (never commit, never in Vite)

| Variable | Where used | Purpose |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `tools/supabase/provision-staff.mjs`, migration/backfill tooling | Admin operations that bypass RLS. Server/CLI only. |
| `SUPABASE_URL` | same tools | Project URL for the server client. |
| `SUPABASE_INVITE_REDIRECT_URL` | same tools | Post-invite redirect (the Vercel URL), e.g. `https://pms.example.com`. |
| `SUPABASE_DB_URL` | `tools/migration/*` | Server-side Postgres connection string for migration/Excel staging. |

Use a local `.env` (git-ignored) or the CI/secret manager for these. See
`supabase/.env.example` equivalents when running local tooling.

## 3. Example files (kept in git)

- `apps/web/.env.example` — browser vars (safe).
- `templates/vercel.env.example` — the exact Vercel browser variables.
- `legacy/pocketbase-deployment/pocketbase.env.example` — **legacy/retired**; do not use.

## 4. Production checklist

- [ ] Vercel browser env contains only `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [ ] No `VITE_*` variable contains a service-role/database password.
- [ ] `tools/` scripts receive the service-role key from the environment, never from git.
- [ ] No real customer/staff PII is committed; use synthetic fixtures.
- [ ] Rotate the service-role key if the repo was ever made public or contained secrets.

## 5. Verifying there is no secret in the tree

```bash
git grep -nEI -- '(BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*[^$\{]|sk-[A-Za-z0-9_-]{20,})' -- ':!*.md' ':!docs/*'
```

(Also run automatically in `supabase-static-security`.)
