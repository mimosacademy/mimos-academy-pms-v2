# LEGACY ONLY — PocketBase deployment. Retired. Do not use for production.
# See legacy/README.md and docs/DEPLOYMENT.md
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/mimos-pms"

apt update
apt install -y git nginx unzip curl certbot python3-certbot-nginx

mkdir -p "$APP_DIR"
mkdir -p /etc/mimos-pms
chmod 750 /etc/mimos-pms

echo "Server packages installed."
echo "Next: clone the GitHub repository into $APP_DIR, create /etc/mimos-pms/pocketbase.env, then install the systemd and nginx files from the deployment pack."
