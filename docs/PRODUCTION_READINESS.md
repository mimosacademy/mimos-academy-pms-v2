# MIMOS Academy PMS V2 — Production Readiness

## Release decision

PMS V2 is production-ready only when every applicable gate below is green. A green frontend build or a clean database security scan alone is not sufficient evidence.

## 1. Architecture gate

Authoritative production architecture:

`React/Vite → Vercel → Supabase Auth / PostgreSQL / Storage / Realtime`

PocketBase is legacy/migration reference material only. It is not a production runtime or security boundary.

Required evidence:

- No production frontend dependency on PocketBase.
- No PocketBase production deployment/runtime requirement.
- Vercel browser environment contains only the Supabase URL and publishable key.
- Supabase service-role/database credentials are never exposed to the browser.

## 2. Application build gate

Required:

- Frontend lint passes.
- Production build passes.
- Latest deployment is successful and READY.
- Dashboard/home route renders without a white-screen failure.
- No blocking console/runtime error is observed during the smoke test.

## 3. Authentication and role gate

Every PMS user must have:

- a Supabase Auth identity;
- a matching `public.staff.auth_user_id`;
- `is_active = true`;
- a valid active `staff_role`.

`public.staff.role_id` and the active staff-role relationship are the authoritative PMS authorization source. Browser metadata/profile role fields must not grant privileges.

Roles to verify:

- SUPER_ADMIN
- ADMIN
- MANAGER
- FINANCE
- SALES
- MASB_TEAM
- PIC
- TRAINER
- VIEWER

Required negative tests:

- Authenticated but unprovisioned users cannot access PMS data.
- Non-admin users cannot modify role, active status, auth identity, or equivalent security-sensitive staff/profile fields.
- MASB_TEAM does not receive Super Admin administration privileges.

## 4. RLS and programme-isolation gate

PostgreSQL RLS is the security boundary.

Required evidence:

- No broad `USING (true)` policy remains on sensitive business tables.
- Programme-scoped roles cannot read or mutate another programme's records.
- PIC/TRAINER programme access follows their authorised assignment.
- VIEWER has read-only access only to data explicitly permitted by the business role model.
- Financial tables are restricted to authorised financial/management/operational roles according to the approved role matrix.
- `anon` has no unintended table or privileged-function access.
- Security-definer helpers are private/internal and cannot be abused as public RPCs.

## 5. CRUD and workflow gate

Exercise the normal application flows, not only direct SQL:

`Opportunity → Quotation → Purchase Order → Programme → Training → Invoice → Payment`

Verify for each applicable role:

- Create.
- Read.
- Update.
- Delete where permitted.
- Status transitions.
- Programme reassignment/cross-programme attempts.
- Invalid IDs and missing required fields.
- Unauthorized direct API attempts.

UI visibility is not evidence of authorization; every mutation must remain protected by database policy.

## 6. Import / Excel gate

Verify:

- Valid rows are classified correctly as `NEW`, `UPDATE`, or `UNCHANGED`.
- Blank/NULL incoming fields do not erase authoritative existing values.
- Duplicate rows inside one import batch are detected.
- Canonical duplicates/conflicts are detected.
- Missing deterministic identity routes to review rather than unsafe mutation.
- `DUPLICATE`, `CONFLICT`, `INCOMPLETE`, `REVIEW`, and `REJECT` cannot enter the promotion queue as normal `NEW`/`UPDATE` operations.
- Canonical comparison hash and promotion hash use the same canonical representation.
- Import retries are idempotent.

## 7. Financial integrity gate

Server-side/database enforcement must prove:

- Valid payment succeeds.
- Payment amount must be positive.
- Payment cannot exceed the invoice amount after valid collections.
- Allocation cannot exceed the payment amount.
- Allocation cannot cause total collections to exceed invoice total.
- Duplicate `operation_id` cannot create a second financial transaction.
- Invoice outstanding cannot become negative.
- Failed/invalid financial operations do not alter collection totals.
- Financial relationships are authoritative from the invoice/payment records rather than browser-supplied programme/client values.

## 8. Audit gate

Verify:

- Important financial/business mutations generate database audit events.
- Application roles cannot directly INSERT/UPDATE/DELETE protected audit records.
- Audit records cannot be used by the browser as a writable history table.
- Actor and event timestamps are generated from trusted server/database context where applicable.

## 9. Storage gate

Object paths must be programme-scoped:

`programmes/{programme_id}/...`

Verify:

- Upload requires a valid programme.
- Upload is permitted only for an authorised programme.
- A user cannot read/download another programme's document.
- Malformed paths cannot trigger unsafe casts or bypass authorization.
- Signed URL lifetime does not exceed the approved maximum.

## 10. Migration/reproducibility gate

Required:

- Migration filenames/versions are unique.
- Already-applied migrations are never rewritten.
- Production-only remediation is represented by forward migrations or documented reconciliation migrations.
- A disposable Supabase environment can apply the repository migration chain without hidden production-only prerequisites.
- Production schema and repository migrations are reconciled and documented.

A migration that succeeds only because an object already exists in production is not considered reproducible.

## 11. CI/CD gate

The quality gate must validate the Supabase/Vercel architecture, including:

- lint/build;
- migration numbering and ordering;
- sensitive RLS checks;
- privileged-function exposure;
- financial-integrity markers/tests;
- storage security markers;
- PocketBase runtime-reference detection;
- secret scanning.

A missing workflow result is not evidence of success.

## 12. Backup / recovery gate

Do not claim disaster-recovery readiness until a restore drill has succeeded.

Required evidence:

- database backup exists according to the actual Supabase plan;
- backup restored to a disposable environment;
- expected schema, RLS, authentication and representative programme/financial flow verified after restore.

## 13. Production smoke test

After every database/security release, verify:

1. Super Admin login and administration access.
2. Manager access.
3. Finance financial access.
4. Sales pipeline access.
5. MASB_TEAM normal operational access without Super Admin administration.
6. PIC programme-scoped access.
7. Trainer programme/training access.
8. Viewer read-only access.
9. Viewer direct invoice/payment access is denied where required by the role matrix.
10. PIC cross-programme access is denied.
11. Valid payment succeeds.
12. Overpayment is rejected server-side.
13. Duplicate payment operation is idempotent/rejected safely.
14. Excess allocation is rejected.
15. Cross-programme document access is denied.
16. Non-admin security-field self-update is denied.
17. Audit event is generated and remains application-immutable.
18. Dashboard and critical routes render successfully.

## 14. Current known exclusions/blockers

Leaked Password Protection is excluded from the acceptance criteria by project direction.

The following remain release blockers until independently evidenced:

- GitHub repository visibility must be changed from PUBLIC to PRIVATE if repository confidentiality is required.
- Full role-by-role E2E requires controlled test identities for all applicable roles.
- Migration reproducibility must be demonstrated against a disposable Supabase environment.
- Backup/restore readiness must not be claimed without a successful restore drill.

## Final rule

Do not declare **PRODUCTION READY** because code has been committed, CI is green, or Security Advisor is clean. Production readiness requires evidence across application behaviour, authorization, data integrity, financial invariants, storage, migrations, backup/recovery and deployment.
