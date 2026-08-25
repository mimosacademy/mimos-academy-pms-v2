# MIMOS Academy PMS V2 — Production Release

## Architecture

- React + Vite frontend
- PocketBase backend/database/authentication
- GitHub for source control
- Vercel for frontend hosting
- Hostinger VPS for PocketBase
- NGINX + HTTPS for the API
- Supabase is not used by this V2 release

## Important

1. `apps/pocketbase/pb_data/` is intentionally excluded. It is production database data and must never be committed.
2. Server secrets are stored in `/etc/mimos-pms/pocketbase.env`, not in GitHub or Vercel.
3. The frontend no longer depends on Hostinger Horizons `/hcgi/platform`.
4. The frontend no longer uses `mockData.js` at runtime. `mockData.js` remains only as a source for the optional `tools/seed-v2.mjs` seed process.
5. Backend role rules are enforced in PocketBase, not only in the React UI.
6. The old V2 hardcoded staff passwords were removed.

## Included operational tools

- `tools/seed-v2.mjs` — optional seed for the supplied V2 business dataset.
- `tools/migrate-v1-to-v2.php` — optional migration from the existing V1 MySQL database to V2 PocketBase.
