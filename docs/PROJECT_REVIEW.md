# MIMOS Academy PMS V2 — Project Review

**Date:** 2026-08-29
**Commit:** `bbf1aa3` (baseline) — this review applies to the repository as of the changes
made in this session (see the deployment-prep commits).

## 1. Executive summary

PMS V2 is a single-page **React + Vite** application backed by **Supabase**
(Auth, PostgreSQL with Row-Level Security, Storage, Realtime) and deployed on **Vercel**.
The architecture is well-documented and the database layer is unusually mature: a long,
ordered migration chain (001→048), strict Row-Level Security, financial-integrity
guardrails (overpayment rejection, `operation_id` idempotency, allocation limits),
an audited staging/import pipeline, and service-role-only promotion functions.

The codebase is **deployment-shaped but not deployment-ready**. The frontend builds, and
the static CI gate passes, but several production-blocking issues existed:

- Two **critical runtime bugs** in the financial/math helpers (one makes the Dashboard and
  finance pages **crash** for any amount ≥ RM 1,000; the other mis-classifies scaled zeros).
- **No automated tests** anywhere (the "quality gate" had none).
- A **committed 32 MB PocketBase binary** and legacy deployment scripts, contradicting the
  documented "PocketBase is legacy-only / not for production" stance.
- **No `package-lock.json`** — `npm ci` (required by the documented release gate) could not run.
- **No `supabase/config.toml`** and no disposable-environment migration/RLS validation in CI.
- A **1.17 MB initial JS bundle** (one chunk).
- A `vercel.json` with **no security headers or asset caching**.

This session addressed all of the above. The detailed findings and the resulting changes
are below.

## 2. Architecture

```
Browser  →  Vercel (static SPA: apps/web)  →  Supabase Edge Functions + RLS
                                                 ├─ Auth (email/password + invitations)
                                                 ├─ PostgreSQL (public + private schemas)
                                                 ├─ Storage (pms-documents, private, programme-scoped)
                                                 └─ Realtime (postgres_changes)
```

- **Security boundary = PostgreSQL RLS.** React route guards (`RoleRoute`) and the nav
  role matrix are convenience/UX controls only. This is the correct model and is documented
  in `README.md`, `docs/DEPLOYMENT.md`, and `docs/PRODUCTION_READINESS.md`.
- **Authorization = `public.staff.role_id`** linked to `auth.users.id`. Browser metadata /
  profile role fields must not be trusted (enforced by `prevent_*_security_field_escalation`).
- **Private schema** holds security-definer authorization helpers
  (`private.has_pms_role`, `private.can_access_programme`) that are not exposed to `anon`.
- **Staging promotion** (`promote_stg_*`) is service-role-only (`015_...`).

## 3. What is already strong

- Complete, ordered, versioned SQL migration chain (001–048) with forward-only policy.
- Explicit RLS on sensitive tables, no broad `USING (true)` on financial/audit tables.
- Financial invariants enforced **in the database** (positive payments, no overpayment,
  allocation ≤ payment, no negative outstanding, `operation_id` uniqueness).
- Append-only audit (`audit_log`/`audit_history`) not writable by application roles.
- Programme-scoped private storage (`programmes/{programme_id}/...`) with RLS + signed URLs.
- A staged, audited Excel/raw-data import pipeline with `data_conflict` for ambiguity.
- Strong runbook docs (`DEPLOYMENT`, `PRODUCTION_READINESS`, `SUPABASE_MIGRATION_RUNBOOK`).
- Static CI checks for architecture markers, RLS, boundary hardening, and secrets.

## 4. Findings (priority order) and what was changed

### 4.1 Critical — financial math bugs (`apps/web/src/lib/format.js`) — FIXED
New unit tests (see 4.2) exposed two defects in the exact-decimal helpers used by the
Dashboards/Reports/Invoices/Programmes pages:

1. **`formatRMCompact` threw `RangeError` for any amount ≥ 1000.** It passed BigInt
   divisors (`1_000_000n`, `1_000n`) into `decimalDivideByInteger`, which validates
   `Number.isInteger(divisor)`. Every Dashboard/Reports/Invoices/Payments/Programmes/
   Quotations/Purchase-Orders stat card that renders a value ≥ RM 1,000 would crash.
2. **`decimalCompare` / `decimalIsZero` treated scaled zeros (`0.000`, `0.00`) as
   non-zero.** `decimalSubtract('1.00','1')` returns `'0.00'`, which the code compared
   with `=== '0'` and fell through to a non-zero result — producing wrong collection
   rates, outstanding buckets, and sort orders.
3. `formatRMCompact` truncating the fractional part of whole-number inputs
   (`2,500,000` → `RM 2.00M`) — also fixed.

### 4.2 No automated tests — ADDRESSED
Added **Vitest** (node environment) and 13 unit tests:
- `apps/web/src/lib/roles.test.js` — guards the UI role→module matrix (esp. that
  `masb_team` cannot reach `/administration`, and Administration is `super_admin`-only).
- `apps/web/src/lib/format.test.js` — exact-decimal math, RM formatting, compact
  formatting, slugging.

### 4.3 Committed legacy PocketBase binary + deployment scripts — CLEANED
- `apps/pocketbase/pocketbase` (32 MB, tracked) removed from the index and working tree;
  added to `.gitignore`.
- Legacy VPS/systemd/nginx/backup scripts moved to `legacy/pocketbase-deployment/` with a
  README marking them **RETIRED**. This removes the risk of someone deploying PocketBase
  and aligns the tree with the documented architecture.

### 4.4 Missing lockfile — GENERATED
- Root `package-lock.json` generated and committed so the documented `npm ci` release gate
  is reproducible.

### 4.5 CI only grepped; no real migration validation — ADDRESSED
- Added `supabase/config.toml` (local/CI).
- Added `scripts/db-regression.sh` (resets a local Supabase stack, applies migrations,
  runs the read-only regression SQL under `supabase/tests/`).
- Added a `supabase-migrations` CI job that boots a disposable Supabase stack via the
  Supabase CLI and runs the full migration + regression checks.

### 4.6 Overlarge bundle — ADDRESSED
- Route-level `React.lazy` code splitting + `manualChunks` vendor groups in `vite.config.js`.
  Initial entry dropped **1,174 kB → 174 kB** (gzip 335 kB → 57 kB); charts/vendors split
  into independently-cached chunks; no chunk-size warning.

### 4.7 Vercel config — HARDENED
- `apps/web/vercel.json` now sets CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and immutable caching for `/assets/*`.

## 5. Other observations / technical debt

| # | Observation | Suggested action |
| --- | --- | --- |
| 1 | `apps/web/src/lib/mockData.js` (76 KB) is **imported nowhere** (dead code) | Confirm, then delete. Prevent accidental production wiring. |
| 2 | `knip.json` references a large set of files that don't exist (`plugins/*`, `site-pages`, `visual-editor/*`) — a stale copy from a Vercel/shadcn template | Regenerate/trim `knip.json` to the real source tree. |
| 3 | Migration version gaps (no `024`, `046`, `047`) | Verify intentional; if deliberate, document as reserved numbers. |
| 4 | `docs/DEPLOYMENT.md` §3 lists the hardening chain as 015/016/017, but the chain now extends to 048 | Update doc to reference the full ordered application. |
| 5 | `.version` = `34` — undocumented | Remove or document. |
| 6 | Reviewer may want to confirm `React` import is intentional (the build uses the automatic JSX runtime). Lint reports 0 errors; only 3 warnings remain. | Optionally clean warnings. |
| 7 | `Leaked Password Protection` explicitly excluded by project direction. | Keep excluded; don't re-add. |
| 8 | Backup/restore restore-drill is **not evidenced** (docs admit it). | Perform a restore drill before claiming DR readiness. |
| 9 | Full role-by-role E2E **not evidenced** (needs controlled test identities). | Create disposable test users per role and run the smoke list. |
| 10 | Real source workbooks (`readme/*.xlsx`, extracted JSON) are committed in-repo. | Move to private storage / org artifacts bucket; keep only manifests + redacted fixtures in-repo. |
| 11 | Node engine `>=20 <23`, `.nvmrc` = 22, CI = 22 — consistent; consider pinning exact minor. | Low priority. |
| 12 | 3 lint warnings (duplicate `lucide-react` imports in `DataTable.jsx`; a `react-hooks/exhaustive-deps` ref-cleanup in `PmsDataContext.jsx`). | Align imports; capture the ref into a local variable in the effect. |

## 6. Security posture

- **No service-role key** present anywhere in browser source (`supabaseClient.js` uses the
  publishable key only).
- `scripts/db-regression.sh` and provisioning tooling require the service-role key at
  **runtime**, never committed.
- `.gitignore` excludes `.env*`, `pb_data/`, `pb_snapshots/`, the PocketBase binary, and
  local Supabase artifacts.
- The static CI secret scan passes.

**Remaining, per `docs/PRODUCTION_READINESS.md`:** the repo visibility (PUBLIC→PRIVATE
decision), one proven restore drill, and a role-by-role E2E against disposable identities
are still open and are gate items, not code items.

## 7. Conclusion

PMS V2 is architecturally sound and materially more deployable after this session. The
highest-risk defects were in the exact-decimal math layer (crash + misclassification),
now covered by tests. The main remaining work is **operational evidence** (restore drill,
role E2E, real client smoke tests) rather than code. See `docs/DEVELOPMENT_PLAN.md` for the
prioritised roadmap.
