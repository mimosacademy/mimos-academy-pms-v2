# MIMOS Academy PMS V2 — Deployment Runbook

## 1. Frontend

Deploy `apps/web` as the Vercel project root.

Required environment variable:

```text
VITE_POCKETBASE_URL=https://api-pms.mimos-academy.com
```

Do not put PocketBase admin credentials, encryption keys, or `pb_data` in Vercel.

## 2. PocketBase VPS

Create a dedicated service account and application directory:

```bash
sudo useradd --system --home /var/lib/mimos-pms --shell /usr/sbin/nologin mimos-pms || true
sudo mkdir -p /var/www/mimos-pms/apps/pocketbase/pb_data /etc/mimos-pms
sudo chown -R mimos-pms:mimos-pms /var/www/mimos-pms/apps/pocketbase/pb_data
sudo chmod 750 /etc/mimos-pms
sudo chmod 640 /etc/mimos-pms/pocketbase.env
```

Create `/etc/mimos-pms/pocketbase.env` with server-only values:

```text
PB_ENCRYPTION_KEY=<strong-unique-encryption-key>
PB_SUPERUSER_EMAIL=<bootstrap-admin-email>
PB_SUPERUSER_PASSWORD=<strong-unique-bootstrap-password>
PB_BOOTSTRAP_USER_EMAIL=<optional-application-admin-email>
PB_BOOTSTRAP_USER_PASSWORD=<optional-application-admin-password>
```

Never commit this file.

Install the systemd unit:

```bash
sudo cp systemd/mimos-pms.service /etc/systemd/system/mimos-pms.service
sudo systemctl daemon-reload
sudo systemctl enable --now mimos-pms
sudo systemctl status mimos-pms --no-pager
curl -fsS http://127.0.0.1:8090/api/health
```

The service runs as `mimos-pms`, not root, and writes only to `pb_data`.

## 3. Migrations

For a new instance, migrations run automatically when PocketBase starts. Before upgrading a live instance:

1. Stop or maintenance-window the application if required.
2. Make a verified backup of `pb_data`.
3. Copy the new migration files.
4. Start PocketBase and inspect `journalctl -u mimos-pms`.
5. Verify `/api/health`.
6. Verify authentication.
7. Verify one read/write operation for the affected module.

Never delete or rewrite an already-applied migration in production. Add a new forward migration instead.

## 4. NGINX / HTTPS

The PocketBase service must remain bound to `127.0.0.1:8090`; public traffic goes through NGINX.

Use the repository NGINX configuration as the reverse-proxy baseline and terminate TLS with the certificate managed by Certbot/your approved certificate manager. The public endpoint must be HTTPS and must proxy the following headers:

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

After certificate installation, verify:

```bash
curl -fsS https://api-pms.mimos-academy.com/api/health
```

## 5. Post-deployment smoke test

Run the following checks from a trusted administration workstation:

- Login as Super Admin.
- Login as Manager.
- Login as Finance.
- Login as Sales.
- Login as Programme PIC.
- Login as Trainer.
- Login as Viewer.
- Create and read a test client/opportunity in a disposable environment.
- Verify an invoice/payment pair.
- Verify an overpayment is rejected by the API.
- Verify a viewer cannot mutate protected collections.
- Verify the deployed frontend can reach the HTTPS PocketBase endpoint.

## 6. Backup / restore

Back up the entire PocketBase data directory and verify restore to a disposable instance. A backup is not considered verified until the restored instance boots, authenticates, and serves expected records.
