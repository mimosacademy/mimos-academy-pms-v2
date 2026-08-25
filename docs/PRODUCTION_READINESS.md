# V2 Production Readiness

## Release gate

The application is production-ready only when all four gates are green:

1. Frontend lint and production build pass in GitHub Actions.
2. PocketBase migrations apply successfully to a fresh instance and a backup copy of production data.
3. Role-based access is verified for all seven application roles.
4. End-to-end business flow is verified from Opportunity → Quotation → PO → Programme → Training → Invoice → Payment.

## Runtime rules

- Never commit `pb_data/`, production credentials, or `.env` files.
- `VITE_POCKETBASE_URL` must point to the HTTPS production PocketBase endpoint.
- PocketBase CORS/reverse proxy must allow the deployed frontend origin.
- Backups must be tested by restoring to a disposable PocketBase instance.

## Data integrity checks

- Relations must reference existing records.
- Invoice outstanding amount must never be negative.
- Payment totals must not exceed the invoice total without an explicit overpayment policy.
- Opportunity probability is constrained to 0–100.
- Programme progress is constrained to 0–100.
- Dates used for operational KPIs must be calculated from the current runtime date, not hard-coded release dates.

## Known connector limitation

The GitHub connector can inspect repository code and GitHub Actions metadata, but a missing workflow-run result is not evidence that CI passed. Production deployment and live PocketBase validation must therefore be explicitly performed in the target environments.
