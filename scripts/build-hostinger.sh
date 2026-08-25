#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"

: "${VITE_POCKETBASE_URL:?Set VITE_POCKETBASE_URL to the HTTPS PocketBase API URL before building}"

npm install
npm run build

echo
echo "Build complete: $ROOT/apps/web/dist"
echo "Upload the CONTENTS of dist/ to Hostinger public_html/."
