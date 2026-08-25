# V2 Production Hardening / Upgrade Notes

- Replaced Hostinger Horizons `/hcgi/platform` dependency with `VITE_POCKETBASE_URL`.
- Removed Hostinger Horizons Vite/editor runtime plugins from the production build.
- Added V2 PocketBase data provider and live CRUD integration.
- Added persistent create/update flows for clients, opportunities, programmes, quotations, purchase orders, invoices, payments and action items.
- Added programme status/progress update workflow.
- Added live Super Admin user administration.
- Removed hardcoded V2 staff passwords from migrations.
- Added backend role-based PocketBase API rules.
- Added secure bootstrap Super Admin via server environment variables.
- Added business relationship fields between programmes, quotations, POs and opportunities.
- Added V2 seed script and optional V1 MySQL migration script.
- Added Vercel SPA routing and environment configuration.
- Added Hostinger systemd/NGINX deployment templates in the separate Deployment Pack.
- Removed production `pb_data` from the release package.
