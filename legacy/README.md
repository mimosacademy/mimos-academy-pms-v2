# Legacy — PocketBase deployment (RETIRED)

> **DO NOT USE FOR PRODUCTION.** These files are retained for historical reference
> only and belong to the retired PocketBase backend that was replaced by the
> **Supabase + Vercel** production architecture.

The authoritative production architecture is:

```
React/Vite  →  Vercel  →  Supabase Auth / PostgreSQL / Storage / Realtime
```

PocketBase is no longer a runtime, backend, or security boundary. It exists only for
legacy V1/V2 data migration and historical reference. See `docs/DEPLOYMENT.md`.

## What is here

| File | Purpose | Status |
| --- | --- | --- |
| `01-server-setup.sh` | Installs git/nginx/ssl on a VPS for PocketBase | RETIRED |
| `02-update-backend.sh` | Git-pull + restart of the PocketBase service | RETIRED |
| `03-backup-pocketbase.sh` | Tarball backup of `pb_data/` | RETIRED |
| `nginx-mimos-pms-api.conf` | nginx reverse proxy to PocketBase on :8090 | RETIRED |
| `systemd-mimos-pms.service` | systemd unit that runs PocketBase | RETIRED |
| `pocketbase.env.example` | Secrets template for the PocketBase service | RETIRED |

## Do not

- Do not start `apps/pocketbase/pocketbase` or any of the above services.
- Do not reference these files from the Vercel application, CI, or release runbook.
- Do not commit `apps/pocketbase/pb_data/`, its binary, or snapshots.

## Migration tooling (still relevant)

The data-migration tools under `tools/migration/` and `tools/supabase/` are **retained**
and are used to move legacy PocketBase/Excel data into Supabase. They are not a runtime.
