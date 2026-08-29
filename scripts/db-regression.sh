#!/usr/bin/env bash
# Applies the Supabase migration chain to a disposable local database and runs the
# repository's read-only regression/security checks (supabase/tests/*.sql).
# Requires the Supabase CLI (which manages its own Docker Postgres container).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if ! command -v supabase >/dev/null 2>&1; then
  echo "error: Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found. Install a PostgreSQL client (e.g. 'postgresql-client')." >&2
  exit 1
fi

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "==> Resetting local Supabase database (applies supabase/migrations in order)"
supabase db reset --local

echo "==> Running migration/security regression checks"
fail=0
for file in "$ROOT"/supabase/tests/*.sql; do
  if [ ! -f "$file" ]; then
    echo "  skipped: no tests under supabase/tests/"
    break
  fi
  echo "  running $(basename "$file")"
  if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file" >/dev/null; then
    echo "    FAILED: $(basename "$file")" >&2
    fail=1
  else
    echo "    ok: $(basename "$file")"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "==> One or more regression checks failed." >&2
  exit 1
fi

echo "==> All migration/security regression checks passed."
