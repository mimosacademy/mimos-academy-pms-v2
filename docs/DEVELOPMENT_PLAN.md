# MIMOS Academy PMS V2 — Development Plan

A prioritised roadmap to take PMS V2 from "codes, builds, and is well-architected" to
"regularly released against a Supabase/Vercel production". Each item lists outcomes and
acceptance evidence. Priorities are **P0** (deployment blocker, do first), **P1** (should
do before first real user), **P2** (hardening/quality).

---

## Phase 0 — Ship the deployment baseline (P0) ✅ done this session

- [x] Remove committed PocketBase binary + legacy deploy scripts; move to `legacy/`.
- [x] Add `package-lock.json` so `npm ci` is reproducible.
- [x] Fix **critical** `format.js` bugs (decimal compare of scaled zeros, `formatRMCompact`
      crash/truncation) and cover them with tests.
- [x] Add `supabase/config.toml` + `scripts/db-regression.sh` + disposable-env CI job.
- [x] Add Vitest tests (role matrix + exact-decimal math).
- [x] Code-split the frontend (entry 1,174 kB → 174 kB).
- [x] Harden `vercel.json` (CSP + security headers + asset caching).

**Gate to pass:** `npm run verify` (lint + test + build) and the static CI checks.

---

## Phase 1 — Production wiring (P1) — requires real accounts

### 1.1 Create and link the Supabase project
- Create a dedicated Supabase project (not the `masb-governance` project), nearest region.
- Apply migrations in order: `supabase db reset --local` then `supabase db push` (or apply
  via the dashboard with `supabase migration up` from a linked project).
- Record the project URL + anon/publishable key as Vercel browser env vars only.

### 1.2 Provision users + roles
- Run `tools/supabase/provision-staff.mjs` (server-side, service-role key) to send Auth
  invites and link `staff.auth_user_id`.
- Verify every user has an active `public.staff` row with a valid `staff_role`.
- Confirm the authoritative-role rule: UI metadata role must never grant privileges.

### 1.3 Storage + Realtime
- Create private bucket `pms-documents`; verify programme-scoped paths and policies.
- Confirm `supabase_realtime` publication covers `payment`, `invoice`, `audit_*` etc.

### 1.4 Vercel project
- Root directory: `apps/web`; Framework: Vite; Install: `npm ci`; Build: `npm run build`.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Point the custom domain (Hostinger DNS) per Vercel's instructions.

**Gate:** smoke login works; Dashboard renders; a programme, invoice and payment flow works.

---

## Phase 2 — Operational evidence (P1/P2)

- [ ] **Role-by-role E2E smoke test** using disposable identities for all documented roles
      (SUPER_ADMIN, ADMIN, MANAGER, FINANCE, SALES, MASB_TEAM, PIC, TRAINER, VIEWER),
      including the negative tests in `docs/PRODUCTION_READINESS.md` §13.
- [ ] **Restore drill** against a disposable Supabase project; verify schema, RLS, auth and
      a representative programme/financial flow. Record the outcome.
- [ ] **Backup/DR**: document the actual plan's backup window and restore path; do not
      claim readiness until the drill passes.
- [ ] **Repo visibility decision**: set private if confidentiality is required.

---

## Phase 3 — Quality & robustness (P2)

### 3.1 Tests
- Convert `supabase/tests/*.sql` read-only checks into pgTAP tests so `supabase test db`
  runs them natively (the current `scripts/db-regression.sh` uses `psql`, which is fine but
  can't run in the CLI's `test db` flow).
- Add React component tests (jsdom + Testing Library) for `ProtectedRoute`, `RoleRoute`,
  `LoginPage`, and the payment idempotency path in `pmsApi.js`.
- Add MSW mocks so component tests don't hit a live Supabase.

### 3.2 Frontend
- Delete dead `mockData.js`; regenerate `knip.json` for the real tree.
- Fix the 3 lint warnings.
- Consider adding `eslint-plugin-react-hooks` exhaustive-deps fixes so the `realtimeTimersRef`
  warning is eliminated.
- Add error boundaries so a single page runtime error doesn't white-screen the app.
- Add a loading skeleton instead of the bare spinner once routes split.

### 3.3 Backfill / data migration
- Run the Excel → staging → canonical pipeline for R1/R2/R3; reconcile counts and spot-check.
- Add idempotent re-run support for `json_to_staging.py`.

### 3.4 Availability & observability
- Add Vercel Analytics / uptime checks for the production URL.
- Add structured error logging via an Edge Function that forwards the caller JWT (not the
  service role) so RLS still applies.
- Add a `/health` or readiness check if a serverless backend is introduced.

---

## Phase 4 — Feature roadmap (idea backlog)

Guided by the "incorporate ideas from GitHub repositories" request — see
`docs/GITHUB_IDEAS.md`.

- **Observability & audit**: audit-table-derived activity feed; per-role drill-down on the
  Financial Integrity report.
- **Security hardening**: migrate JWT signing to asymmetric (RS256/ES256); add MFA for
  FINANCE/SUPER_ADMIN; strict Edge-Function CORS; deny-by-default Storage access.
- **Files**: upload progress, virus scan hook (server-side), versioned programme documents,
  signed-URL expiry aligned to an approved maximum.
- **Import UX**: in-app conflict resolution queue (replace "review later" with guided merge).
- **Testing/CI**: enable the `supabase-migrations` job on PRs; add a deployment preview for
  each PR; add a nightly secret scan (e.g. gitleaks) and dependency audit.

---

## Definition of Done (release checklist)

1. `npm run verify` green (lint + test + build).
2. Static CI green (architecture/RLS/secrets markers).
3. `supabase-migrations` CI green (disposable DB applies the full chain + regression).
4. Disposable **staging** Supabase project mirrors production schema.
5. Provisioned users: one per role; smoke tests pass incl. negative tests.
6. Storage programme-isolation verified for two programmes.
7. Restore drill passed; backup documented.
8. Vercel production deploy READY; custom domain verified; browser smoke tests pass.
9. No `SUPABASE_SERVICE_ROLE_KEY` in browser source or Vercel browser env.
