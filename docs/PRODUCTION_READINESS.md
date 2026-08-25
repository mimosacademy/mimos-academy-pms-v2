# V2 Production Readiness

## Release gate

The application is production-ready only when all release gates are green:

1. Frontend lint and production build pass in GitHub Actions.
2. PocketBase migrations apply successfully to a fresh instance.
3. PocketBase boots and `/api/health` responds successfully.
4. Superuser authentication succeeds in the fresh instance.
5. All seven application roles are exercised against real PocketBase API rules.
6. Financial integrity is exercised against real API writes: valid payment succeeds, overpayment is rejected, and an invoice cannot be reduced below recorded collections.
7. End-to-end business flow is verified from Opportunity → Quotation → PO → Programme → Training → Invoice → Payment.
8. Production VPS and Vercel environment variables are configured and the deployed frontend can reach the HTTPS PocketBase endpoint.
9. A production-data backup has been restored successfully to a disposable PocketBase instance.

## Automated gates

The `V2 Quality Gate` workflow validates:

- React/Vite lint and production build.
- Typed PocketBase migration constructors.
- No tracked `pb_data`.
- No production `demoAction` references.
- No production imports of mock data.
- Canonical unique business identifiers and duplicate-migration detection.
- V1 migration PHP syntax and opportunity-stage mapping.
- PocketBase financial hook syntax.
- Role-matrix smoke-script syntax.
- Fresh PocketBase migration.
- PocketBase version consistency.
- PocketBase health and superuser authentication.
- Seven-role authorization matrix.
- Financial API integrity: payment overage and invoice-reduction protection.

## Runtime rules

- Never commit `pb_data/`, production credentials, or `.env` files.
- `VITE_POCKETBASE_URL` must point to the HTTPS production PocketBase endpoint.
- PocketBase must remain bound to localhost on the VPS and be exposed publicly through NGINX/HTTPS.
- Backend role rules are enforced in PocketBase, not only in the React UI.
- Backups must be tested by restoring to a disposable PocketBase instance.
- Already-applied migrations must not be rewritten; add forward migrations instead.

## Data integrity checks

- Relations must reference existing records.
- Business identifiers are unique at the database layer.
- Invoice outstanding amount must never be negative.
- Payment totals must not exceed the invoice total.
- Failed payments do not count toward collection totals.
- An invoice cannot be reduced below already recorded valid collections.
- Opportunity probability is constrained to 0–100.
- Programme progress is constrained to 0–100.
- Dates used for operational KPIs are calculated from the current runtime date.

## Manual environment gates

The GitHub workflow cannot prove the health of the real VPS/Vercel deployment or the safety of production data. Before release, execute `docs/DEPLOYMENT.md` against the target infrastructure.

Required evidence:

- `https://api-pms.mimos-academy.com/api/health` returns success.
- Frontend production URL loads and authenticates.
- All seven roles can authenticate with their intended permissions.
- A disposable backup restore boots successfully.
- Full business-flow test passes using non-production test data.

A missing workflow-run result is not evidence that CI passed. A successful CI run is also not evidence that the real production environment is healthy.
