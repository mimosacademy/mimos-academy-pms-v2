# LEGACY ONLY — PocketBase deployment. Retired. Do not use for production.
# See legacy/README.md and docs/DEPLOYMENT.md
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/var/www/mimos-pms"

cd "$APP_DIR"
git pull origin main
chmod +x apps/pocketbase/pocketbase
systemctl restart mimos-pms
systemctl --no-pager --full status mimos-pms
