# LEGACY ONLY — PocketBase deployment. Retired. Do not use for production.
# See legacy/README.md and docs/DEPLOYMENT.md
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/mimos-pms"
BACKUP_DIR="/var/backups/mimos-pms"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/pb_data_$STAMP.tar.gz"   -C "$APP_DIR/apps/pocketbase" pb_data

find "$BACKUP_DIR" -type f -name 'pb_data_*.tar.gz' -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/pb_data_$STAMP.tar.gz"
