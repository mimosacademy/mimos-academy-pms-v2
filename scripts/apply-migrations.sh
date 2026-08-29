#!/usr/bin/env bash
# Deterministic migration runner for MIMOS Academy PMS V2.
# Applies every migration in supabase/migrations/ in filename order, aborting
# on the first error (ON_ERROR_STOP=1). Bypasses the Supabase CLI version
# renumbering that conflicts with the repo's 3-digit prefixes.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://..." scripts/apply-migrations.sh
#
#   SUPABASE_DB_URL must be a direct (session-pooler) Postgres connection string
#   for the target database. Never put this in the browser or in Vite env vars.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "error: SUPABASE_DB_URL is required (server-side only; never a browser var)." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found (install a PostgreSQL client)." >&2
  exit 1
fi

# Deterministic order: filename ascending (respects 001..048 with gaps kept).
mapfile -t FILES < <(ls -1 "$MIGRATIONS_DIR"/*.sql | sort)

echo "==> Found ${#FILES[@]} migrations to apply (in filename order)."
applied=0
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  echo "==> Applying $name"
  if ! psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"; then
    echo "    FAILED at $name" >&2
    echo "    Applied $applied / ${#FILES[@]} before failure." >&2
    exit 1
  fi
  applied=$((applied + 1))
done

echo "==> All ${#FILES[@]} migrations applied successfully."

# Optional: run the read-only regression/security checks.
if [ "${RUN_REGRESSION:-0}" = "1" ]; then
  echo "==> Running regression/security checks under supabase/tests/"
  fail=0
  for t in "$ROOT"/supabase/tests/*.sql; do
    if [ -f "$t" ]; then
      echo "    running $(basename "$t")"
      if ! psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$t"; then
        echo "      FAILED: $(basename "$t")" >&2
        fail=1
      fi
    fi
  done
  [ "$fail" -eq 0 ] && echo "==> Regression checks passed." || exit 1
fi
