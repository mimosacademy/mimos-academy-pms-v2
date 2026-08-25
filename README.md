# MIMOS Academy PMS V2 — Production Release

## Architecture

- React + Vite frontend
- PocketBase backend/database/authentication
- GitHub for source control
- Hostinger VPS for PocketBase/API
- Apache/Hostinger `public_html` for the built frontend, or Vercel as an alternative
- NGINX + HTTPS for the API
- Supabase is not used by this V2 release

## V1 → V2 continuity

V2 is intended to replace the deployed V1 system, not become a disconnected demo. The V1 system contains three operational data areas: R1 financial/quotation/PO/invoice/collection data, R2 training delivery and participant demographics, and R3 sales funnel data. The V2 model separates these into related enterprise entities while preserving the business relationships.

For production migration from the existing V1 MySQL database, use `tools/migrate-v1-to-v2-safe.php`. It is idempotent, maps the V1 R1/R2/R3 records, preserves V1 programme IDs, creates linked quotation/PO/invoice/payment records, preserves R2 participant totals/demographics, and maps the V1 funnel status into the V2 opportunity stage without violating V2 select-field validation.

The older `tools/migrate-v1-to-v2.php` is retained for historical reference and should not be used for the production cut-over.

## Important

1. `apps/pocketbase/pb_data/` is intentionally excluded. It is production database data and must never be committed.
2. Server secrets are stored in `/etc/mimos-pms/pocketbase.env`, not in GitHub or frontend source.
3. The frontend no longer depends on Hostinger Horizons `/hcgi/platform`.
4. The frontend no longer uses `mockData.js` at runtime. `mockData.js` remains only as a source for the optional seed process.
5. Backend role rules are enforced in PocketBase, not only in the React UI.
6. V2 has no hardcoded production staff passwords.
7. The frontend must be built before uploading to Hostinger `public_html`; upload the contents of `apps/web/dist/`, not the React source tree.
8. `apps/web/public/.htaccess` provides the React Router fallback required by Apache/Hostinger.
9. PocketBase must run as a server/API; do not place the PocketBase binary in `public_html`.

## Hostinger frontend build

```bash
cd apps/web
npm install
npm run build
```

Upload the generated `apps/web/dist/` contents into the Hostinger site's `public_html/`. Set `VITE_POCKETBASE_URL` at build time to the HTTPS PocketBase API URL.

## Included operational tools

- `tools/seed-v2.mjs` — optional seed for the supplied V2 business dataset.
- `tools/migrate-v1-to-v2-safe.php` — production V1 MySQL → V2 PocketBase migration.
- `tools/migrate-v1-to-v2.php` — legacy migration script retained for reference only.
- `scripts/03-backup-pocketbase.sh` — PocketBase backup helper.
